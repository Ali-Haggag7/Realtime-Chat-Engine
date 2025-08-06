import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: "reactchat-1f359.firebaseapp.com",
    projectId: "reactchat-1f359",
    storageBucket: "reactchat-1f359.firebasestorage.app",
    messagingSenderId: "1054146514956",
    appId: "1:1054146514956:web:8cec370162846fedf09e29"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth()
export const db = getFirestore()
