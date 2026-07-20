import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  deleteDoc,
  limit,
} from "firebase/firestore";
import { db } from "../config";
import { UserProfile } from "@/types";

const COL = "users";

export const createUserProfile = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<void> => {
  await setDoc(doc(db, COL, uid), {
    ...data,
    uid,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    isVerified: false,
    isPrivate: false,
    fcmToken: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const getUserProfile = async (
  uid: string
): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, COL, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const updateUserProfile = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<void> => {
  await updateDoc(doc(db, COL, uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const getUserByUsername = async (
  username: string
): Promise<UserProfile | null> => {
  try {
    const q = query(
      collection(db, COL),
      where("username", "==", username),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as UserProfile);
  } catch {
    return null;
  }
};

export const searchUsers = async (term: string): Promise<UserProfile[]> => {
  const q = query(
    collection(db, COL),
    where("username", ">=", term),
    where("username", "<=", term + "\uf8ff"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
};

export const followUser = async (
  currentUserId: string,
  targetUserId: string
): Promise<void> => {
  await setDoc(doc(db, COL, currentUserId, "following", targetUserId), {
    userId: targetUserId,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, COL, targetUserId, "followers", currentUserId), {
    userId: currentUserId,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, COL, currentUserId), {
    followingCount: increment(1),
  });
  await updateDoc(doc(db, COL, targetUserId), {
    followersCount: increment(1),
  });
};

export const unfollowUser = async (
  currentUserId: string,
  targetUserId: string
): Promise<void> => {
  await deleteDoc(doc(db, COL, currentUserId, "following", targetUserId));
  await deleteDoc(doc(db, COL, targetUserId, "followers", currentUserId));
  await updateDoc(doc(db, COL, currentUserId), {
    followingCount: increment(-1),
  });
  await updateDoc(doc(db, COL, targetUserId), {
    followersCount: increment(-1),
  });
};

export const isFollowing = async (
  currentUserId: string,
  targetUserId: string
): Promise<boolean> => {
  const snap = await getDoc(
    doc(db, COL, currentUserId, "following", targetUserId)
  );
  return snap.exists();
};

export const updateFCMToken = async (
  uid: string,
  token: string
): Promise<void> => {
  await updateDoc(doc(db, COL, uid), {
    fcmToken: token,
    updatedAt: serverTimestamp(),
  });
};
