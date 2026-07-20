import {
  ref,
  set,
  push,
  get,
  update,
  onValue,
  off,
  query as rtdbQuery,
  orderByChild,
  limitToLast,
} from "firebase/database";
import { rtdb } from "../config";
import { ChatRoom, Message, MessageType } from "@/types";

export const getOrCreateChatRoom = async (
  userId1: string,
  userId2: string
): Promise<string> => {
  const chatId = [userId1, userId2].sort().join("_");
  const chatRef = ref(rtdb, `chats/${chatId}`);
  const snap = await get(chatRef);

  if (!snap.exists()) {
    await set(chatRef, {
      id: chatId,
      participants: [userId1, userId2],
      participantsMap: { [userId1]: true, [userId2]: true },
      lastMessage: "",
      lastMessageTime: Date.now(),
      lastMessageSenderId: "",
      lastMessageType: "text",
      unreadCount: { [userId1]: 0, [userId2]: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return chatId;
};

export const sendMessage = async (
  chatId: string,
  senderId: string,
  content: string,
  type: MessageType = "text",
  mediaUrl?: string,
  mediaPublicId?: string,
  replyTo?: string
): Promise<string> => {
  const msgRef = push(ref(rtdb, `chats/${chatId}/messages`));
  const msgId = msgRef.key!;

  const message: Message = {
    id: msgId,
    chatId,
    senderId,
    content,
    type,
    mediaUrl: mediaUrl || null,
    mediaPublicId: mediaPublicId || null,
    isRead: false,
    isDeleted: false,
    replyTo: replyTo || null,
    reactions: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await set(msgRef, message);

  const chatSnap = await get(ref(rtdb, `chats/${chatId}`));
  const chatData = chatSnap.val() as ChatRoom;
  const otherId = chatData.participants.find((id) => id !== senderId)!;

  await update(ref(rtdb, `chats/${chatId}`), {
    lastMessage: type === "text" ? content : `📎 ${type}`,
    lastMessageTime: Date.now(),
    lastMessageSenderId: senderId,
    lastMessageType: type,
    [`unreadCount/${otherId}`]: (chatData.unreadCount[otherId] || 0) + 1,
    updatedAt: Date.now(),
  });

  return msgId;
};

export const subscribeToMessages = (
  chatId: string,
  callback: (messages: Message[]) => void,
  msgLimit = 50
): (() => void) => {
  const q = rtdbQuery(
    ref(rtdb, `chats/${chatId}/messages`),
    orderByChild("createdAt"),
    limitToLast(msgLimit)
  );

  const listener = onValue(q, (snap) => {
    const msgs: Message[] = [];
    snap.forEach((child) => {
      msgs.push(child.val() as Message);
      return false; // ← এটাই fix, forEach-এ boolean return করতে হয়
    });
    callback(msgs);
  });

  return () => off(q, "value", listener);
};

export const subscribeToChatRooms = (
  userId: string,
  callback: (chats: ChatRoom[]) => void
): (() => void) => {
  const chatsRef = ref(rtdb, "chats");

  const listener = onValue(chatsRef, (snap) => {
    const chats: ChatRoom[] = [];
    snap.forEach((child) => {
      const data = child.val() as ChatRoom;
      if (data.participantsMap?.[userId]) chats.push(data);
      return false; // ← fix
    });
    chats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    callback(chats);
  });

  return () => off(chatsRef, "value", listener);
};

export const markMessagesAsRead = async (
  chatId: string,
  userId: string
): Promise<void> => {
  await update(ref(rtdb, `chats/${chatId}`), {
    [`unreadCount/${userId}`]: 0,
  });
};

export const deleteMessage = async (
  chatId: string,
  messageId: string
): Promise<void> => {
  await update(ref(rtdb, `chats/${chatId}/messages/${messageId}`), {
    isDeleted: true,
    content: "This message was deleted",
    updatedAt: Date.now(),
  });
};

export const addReaction = async (
  chatId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> => {
  const reactRef = ref(
    rtdb,
    `chats/${chatId}/messages/${messageId}/reactions/${emoji}`
  );
  const snap = await get(reactRef);
  const list: string[] = snap.exists() ? snap.val() : [];

  const idx = list.indexOf(userId);
  if (idx > -1) list.splice(idx, 1);
  else list.push(userId);

  await set(reactRef, list);
};
