import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  writeBatch,
  startAfter,
  DocumentSnapshot,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../config";
import { Notification, NotificationType } from "@/types";

const COL = "notifications";

export const createNotification = async (
  data: Omit<Notification, "id" | "createdAt" | "isRead">
): Promise<void> => {
  // Don't notify yourself
  if (data.senderId === data.recipientId) return;

  await addDoc(collection(db, COL), {
    ...data,
    isRead: false,
    createdAt: serverTimestamp(),
  });
};

export const getNotifications = async (
  userId: string,
  lastNotif?: DocumentSnapshot,
  pageSize = 20
): Promise<{ notifications: Notification[]; lastDoc: DocumentSnapshot | null }> => {
  const constraints: any[] = [
    where("recipientId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  ];
  if (lastNotif) constraints.push(startAfter(lastNotif));

  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return {
    notifications: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await updateDoc(doc(db, COL, id), { isRead: true });
};

export const markAllRead = async (userId: string): Promise<void> => {
  const q = query(
    collection(db, COL),
    where("recipientId", "==", userId),
    where("isRead", "==", false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COL),
    where("recipientId", "==", userId),
    where("isRead", "==", false)
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, COL),
    where("recipientId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
  });
};
