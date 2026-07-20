import { Timestamp } from "firebase/firestore";

// ═══════════════════════════════════
// USER TYPES
// ═══════════════════════════════════

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  photoURL: string | null;
  coverPhotoURL: string | null;
  bio: string;
  website: string;
  location: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified: boolean;
  isPrivate: boolean;
  fcmToken: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FollowRelation {
  userId: string;
  createdAt: Timestamp;
}

// ═══════════════════════════════════
// POST TYPES
// ═══════════════════════════════════

export type MediaType = "image" | "video";

export interface MediaItem {
  url: string;
  type: MediaType;
  publicId: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  media: MediaItem[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  hashtags: string[];
  mentions: string[];
  location: string | null;
  isPublic: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ═══════════════════════════════════
// COMMENT TYPES
// ═══════════════════════════════════

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  likesCount: number;
  repliesCount: number;
  parentId: string | null;
  mentions: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ═══════════════════════════════════
// LIKE TYPES
// ═══════════════════════════════════

export interface Like {
  id: string;
  userId: string;
  targetId: string;
  targetType: "post" | "comment";
  createdAt: Timestamp;
}

// ═══════════════════════════════════
// NOTIFICATION TYPES
// ═══════════════════════════════════

export type NotificationType =
  | "like_post"
  | "like_comment"
  | "comment"
  | "reply"
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "mention_post"
  | "mention_comment"
  | "share";

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  type: NotificationType;
  targetId: string;
  targetType: "post" | "comment" | "user";
  isRead: boolean;
  createdAt: Timestamp;
}

// ═══════════════════════════════════
// CHAT TYPES (Realtime Database)
// ═══════════════════════════════════

export type MessageType = "text" | "image" | "video" | "audio";

export interface ChatRoom {
  id: string;
  participants: string[];
  participantsMap: { [userId: string]: boolean };
  lastMessage: string;
  lastMessageTime: number;
  lastMessageSenderId: string;
  lastMessageType: MessageType;
  unreadCount: { [userId: string]: number };
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MessageType;
  mediaUrl: string | null;
  mediaPublicId: string | null;
  isRead: boolean;
  isDeleted: boolean;
  replyTo: string | null;
  reactions: { [emoji: string]: string[] };
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════
// PRESENCE TYPES (Realtime Database)
// ═══════════════════════════════════

export interface UserPresence {
  online: boolean;
  lastSeen: number;
}

export interface TypingStatus {
  [userId: string]: boolean;
}
