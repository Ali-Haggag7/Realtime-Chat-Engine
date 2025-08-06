import "./addUser.css"
import { useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, arrayUnion, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useUserStore } from "../../../../lib/userStore";

const AddUser = () => {
    const [user, setUser] = useState(null);
    const [isAdded, setIsAdded] = useState(false);

    const { currentUser } = useUserStore();

    const handleSearch = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get("username");

        try {
            const userRef = collection(db, "users");
            const q = query(userRef, where("username", "==", username));
            const querySnapShot = await getDocs(q);

            if (!querySnapShot.empty) {
                const foundUser = querySnapShot.docs[0].data();
                setUser(foundUser);

                // تحقق إذا المستخدم مضاف عند currentUser
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
            console.log(error);
        }
    };

    const handleAdd = async () => {
        try {
            const chatRef = collection(db, "chats");
            const userChatsRef = collection(db, "userchats");

            const newChatRef = doc(chatRef);

            await setDoc(newChatRef, {
                createdAt: serverTimestamp(),
                messages: [],
            });

            await setDoc(doc(userChatsRef, user.id), {
                chats: arrayUnion({
                    chatId: newChatRef.id,
                    lastMessage: "",
                    receiverId: currentUser.id,
                    updatedAt: Date.now(),
                }),
            }, { merge: true });

            await setDoc(doc(userChatsRef, currentUser.id), {
                chats: arrayUnion({
                    chatId: newChatRef.id,
                    lastMessage: "",
                    receiverId: user.id,
                    updatedAt: Date.now(),
                }),
            }, { merge: true });

            // بعد الإضافة حدث isAdded
            setIsAdded(true);
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className="addUserWrapper">
            <div className="addUser">
                <h3>Add new user</h3>
                <form onSubmit={handleSearch}>
                    <input type="text" placeholder="Username" name="username" />
                    <button>Search</button>
                </form>

                {user && (
                    <div className="user">
                        <div className="user-details">
                            <img src={user.avatar || "./avatar.png"} alt="" />
                            <span>{user.username}</span>
                        </div>

                        {user.id === currentUser.id ? (
                            <span style={{ fontWeight: "bold", color: "gray" }}>You</span>
                        ) : isAdded ? null : (
                            <button onClick={handleAdd}>Add User</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddUser;
