import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../config";
import { updateFCMToken } from "./userService";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const requestPushPermission = async (
  userId: string
): Promise<string | null> => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      await updateFCMToken(userId, token);
      return token;
    }
    return null;
  } catch (err) {
    console.error("FCM token error:", err);
    return null;
  }
};

export const onForegroundMessage = async (
  callback: (payload: any) => void
): Promise<(() => void) | null> => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;
  return onMessage(messaging, callback);
};
