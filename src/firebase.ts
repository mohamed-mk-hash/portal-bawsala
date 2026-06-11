import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDQl4lLiu8is2rem2tM3rlU-8HERH46EQY",
  authDomain: "bawsala-portal.firebaseapp.com",
  projectId: "bawsala-portal",
  storageBucket: "bawsala-portal.firebasestorage.app",
  messagingSenderId: "399092939471",
  appId: "1:399092939471:web:9b6c908574175a448cd5ba",
  measurementId: "G-G5KRHNF0QY"
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});