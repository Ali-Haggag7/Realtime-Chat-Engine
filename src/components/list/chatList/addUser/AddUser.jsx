import { useState, useCallback, memo } from "react";
import { doc, getDoc, collection, query, where, getDocs, arrayUnion, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useUserStore } from "../../../../lib/userStore";
import "./addUser.css";

// Memoized to prevent re-renders from parent state changes
const AddUser = memo(() => {
    const [user, setUser] = useState(null);
    const [isAdded, setIsAdded] = useState(false);

    // UI Locks to prevent race conditions & double-clicks
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const { currentUser } = useUserStore();

    // Stable ref to prevent reallocation
    const handleSearch = useCallback(async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get("username");

        if (!username || !currentUser?.id) return;

        setIsSearching(true);

        try {
            const userRef = collection(db, "users");
            const q = query(userRef, where("username", "==", username));
            const querySnapShot = await getDocs(q);

            if (!querySnapShot.empty) {
                const foundUser = querySnapShot.docs[0].data();
                setUser(foundUser);

                // Check if user already exists in current user's chats
                const userChatsRef = doc(db, "userchats", currentUser.id);
                const userChatsSnap = await getDoc(userChatsRef);

                if (userChatsSnap.exists()) {
                    const userChatsData = userChatsSnap.data();
                    const added = userChatsData.chats.some(
                        (chat) => chat.receiverId === foundUser.id
                    );
                    setIsAdded(added);
                } else {
                    setIsAdded(false);
                }
            } else {
                setUser(null);
                setIsAdded(false);
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    }, [currentUser?.id]);

    // Stable ref to prevent reallocation
    const handleAdd = useCallback(async () => {
        if (!user?.id || !currentUser?.id) return;

        setIsAdding(true);

        try {
            const chatRef = collection(db, "chats");
            const userChatsRef = collection(db, "userchats");
            const newChatRef = doc(chatRef);

            // Parallel execution for independent writes to reduce latency
            await Promise.all([
                setDoc(newChatRef, {
                    createdAt: serverTimestamp(),
                    messages: [],
                }),
                setDoc(doc(userChatsRef, user.id), {
                    chats: arrayUnion({
                        chatId: newChatRef.id,
                        lastMessage: "",
                        receiverId: currentUser.id,
                        updatedAt: Date.now(),
                    }),
                }, { merge: true }),
                setDoc(doc(userChatsRef, currentUser.id), {
                    chats: arrayUnion({
                        chatId: newChatRef.id,
                        lastMessage: "",
                        receiverId: user.id,
                        updatedAt: Date.now(),
                    }),
                }, { merge: true })
            ]);

            setIsAdded(true);
        } catch (error) {
            console.error("Failed to add user:", error);
        } finally {
            setIsAdding(false);
        }
    }, [user, currentUser?.id]);

    return (
        <div className="add-user-container">
            <div className="add-user-modal">
                <h3>Add New User</h3>
                <form onSubmit={handleSearch}>
                    <input
                        type="text"
                        placeholder="Username"
                        name="username"
                        disabled={isSearching}
                        autoComplete="off"
                    />
                    <button type="submit" disabled={isSearching}>
                        {isSearching ? "Searching..." : "Search"}
                    </button>
                </form>

                {user && (
                    <div className="user-result">
                        <div className="user-details">
                            <img
                                src={user.avatar || "./avatar.png"}
                                alt={`${user.username}'s avatar`}
                                loading="lazy"
                                decoding="async"
                            />
                            <span>{user.username}</span>
                        </div>

                        {user.id === currentUser.id ? (
                            <span className="badge-self">You</span>
                        ) : isAdded ? (
                            <span className="badge-added">Added</span>
                        ) : (
                            <button
                                onClick={handleAdd}
                                disabled={isAdding}
                                className="add-btn"
                            >
                                {isAdding ? "Adding..." : "Add User"}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

AddUser.displayName = "AddUser";
export default AddUser;