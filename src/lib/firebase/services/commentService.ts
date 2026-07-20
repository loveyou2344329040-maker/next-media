import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  DocumentSnapshot,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../config";
import { Comment } from "@/types";

const COL = "comments";

export const addComment = async (
  data: Omit<Comment, "id" | "createdAt" | "updatedAt" | "likesCount" | "repliesCount">
): Promise<string> => {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    likesCount: 0,
    repliesCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", data.postId), { commentsCount: increment(1) });
  if (data.parentId) {
    await updateDoc(doc(db, COL, data.parentId), { repliesCount: increment(1) });
  }
  return ref.id;
};

export const getComments = async (
  postId: string,
  lastComment?: DocumentSnapshot,
  pageSize = 20
): Promise<{ comments: Comment[]; lastDoc: DocumentSnapshot | null }> => {
  const constraints: any[] = [
    where("postId", "==", postId),
    where("parentId", "==", null),
    orderBy("createdAt", "asc"),
    limit(pageSize),
  ];
  if (lastComment) constraints.push(startAfter(lastComment));

  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return {
    comments: snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
  };
};

export const getReplies = async (
  parentId: string,
  pageSize = 10
): Promise<Comment[]> => {
  const q = query(
    collection(db, COL),
    where("parentId", "==", parentId),
    orderBy("createdAt", "asc"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
};

export const deleteComment = async (
  commentId: string,
  postId: string,
  parentId: string | null
): Promise<void> => {
  await deleteDoc(doc(db, COL, commentId));
  await updateDoc(doc(db, "posts", postId), { commentsCount: increment(-1) });
  if (parentId) {
    await updateDoc(doc(db, COL, parentId), { repliesCount: increment(-1) });
  }
};

export const subscribeToComments = (
  postId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, COL),
    where("postId", "==", postId),
    where("parentId", "==", null),
    orderBy("createdAt", "asc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)));
  });
};
