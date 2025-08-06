import { create } from 'zustand'
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from "./firebase"

export const useUserStore = create((set, get) => ({
    currentUser: null,
    isloading: true,

    fetchUserInfo: async (uid) => {
        if (!uid) return set({ currentUser: null, isloading: false });

        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                set({ currentUser: docSnap.data(), isloading: false });
            } else {
                set({ currentUser: null, isloading: false });
            }
        } catch (error) {
            console.log(error);
            set({ currentUser: null, isloading: false });
        }
    },

    updateUser: async (newData) => {
        const user = get().currentUser;
        if (!user?.id) return;

        const userRef = doc(db, "users", user.id);
        try {
            await updateDoc(userRef, newData);
            // update local state as well
            set((state) => ({
                currentUser: {
                    ...state.currentUser,
                    ...newData,
                },
            }));
        } catch (err) {
            console.error("Failed to update user:", err);
        }
    },
}));