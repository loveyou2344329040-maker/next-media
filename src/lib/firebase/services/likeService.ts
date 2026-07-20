import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../config";

const COL = "likes";
const likeId = (userId: string, targetId: string) => `${userId}_${targetId}`;

export const toggleLikePost = async (
  userId: string,
  postId: string
): Promise<boolean> => {
  const ref = doc(db, COL, likeId(userId, postId));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await deleteDoc(ref);
    await updateDoc(doc(db, "posts", postId), { likesCount: increment(-1) });
    return false;
  } else {
    await setDoc(ref, {
      id: likeId(userId, postId),
      userId,
      targetId: postId,
      targetType: "post",
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "posts", postId), { likesCount: increment(1) });
    return true;
  }
};

export const toggleLikeComment = async (
  userId: string,
  commentId: string
): Promise<boolean> => {
  const ref = doc(db, COL, likeId(userId, commentId));
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await deleteDoc(ref);
    await updateDoc(doc(db, "comments", commentId), { likesCount: increment(-1) });
    return false;
  } else {
    await setDoc(ref, {
      id: likeId(userId, commentId),
      userId,
      targetId: commentId,
      targetType: "comment",
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "comments", commentId), { likesCount: increment(1) });
    return true;
  }
};

export const isPostLiked = async (
  userId: string,
  postId: string
): Promise<boolean> => {
  const snap = await getDoc(doc(db, COL, likeId(userId, postId)));
  return snap.exists();
};

export const getLikedPostIds = async (userId: string): Promise<string[]> => {
  const q = query(
    collection(db, COL),
    where("userId", "==", userId),
    where("targetType", "==", "post")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().targetId);
};
