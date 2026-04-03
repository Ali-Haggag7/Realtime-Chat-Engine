import { useEffect, useState, useCallback, useMemo, useDeferredValue, memo } from "react";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useUserStore } from "../../../lib/userStore";
import { useChatStore } from "../../../lib/chatStore";
import AddUser from "./addUser/AddUser";
import "./chatList.css";

// --- Memoized Child Component (Zero-Jank Rendering) ---
// Extracted to prevent the inline-function reallocation in the map loop.
const ChatItem = memo(({ chat, currentUserId, onSelect }) => {
    const isBlocked = chat.user.blocked?.includes(currentUserId);
    const avatarSrc = isBlocked || !chat.user.avatar ? "./avatar.png" : chat.user.avatar;
    const username = isBlocked ? "User" : chat.user.username;

    // Stable ref to prevent layout thrashing on click
    const handleClick = useCallback(() => {
        onSelect(chat);
    }, [chat, onSelect]);

    return (
        <button
            className="item"
            onClick={handleClick}
            data-seen={chat.isSeen}
            aria-label={`Chat with ${username}`}
        >
            <img src={avatarSrc} alt="" loading="lazy" decoding="async" />
            <div className="texts">
                <span>{username}</span>
                <p>{chat.lastMessage}</p>
            </div>
            {!chat.isSeen && <div className="unread-dot" />}
        </button>
    );
});
ChatItem.displayName = "ChatItem";

// --- Main Component ---
const ChatList = () => {
    const [chats, setChats] = useState([]);
    const [addMode, setAddMode] = useState(false);
    const [input, setInput] = useState("");

    // React 18: Offloads the filtering math to a background priority, 
    // ensuring the text input never stutters while typing.
    const deferredInput = useDeferredValue(input);

    const { currentUser } = useUserStore();
    const { changeChat } = useChatStore();

    useEffect(() => {
        if (!currentUser?.id) return;

        const userChatsRef = doc(db, "userchats", currentUser.id);

        const unSub = onSnapshot(userChatsRef, async (res) => {
            if (!res.exists()) {
                setChats([]);
                return;
            }

            const items = res.data().chats || [];

            // Executes the heavy reads in parallel to cut down network waterfalls
            const chatData = await Promise.all(
                items.map(async (item) => {
                    const userDocRef = doc(db, "users", item.receiverId);
                    const userDocSnap = await getDoc(userDocRef);
                    return { ...item, user: userDocSnap.data() };
                })
            );

            setChats(chatData.sort((a, b) => b.updatedAt - a.updatedAt));
        });

        return () => unSub();
    }, [currentUser?.id]);

    // Memoized so we don't recreate this function on every render
    const handleSelect = useCallback(async (selectedChat) => {
        if (!currentUser?.id) return;

        const userChats = chats.map((item) => {
            const { user, ...rest } = item;
            return rest;
        });

        const chatIndex = userChats.findIndex((item) => item.chatId === selectedChat.chatId);
        if (chatIndex === -1) return;

        userChats[chatIndex].isSeen = true;

        try {
            await updateDoc(doc(db, "userchats", currentUser.id), {
                chats: userChats,
            });
            changeChat(selectedChat.chatId, selectedChat.user);
        } catch (err) {
            console.error("Failed to update chat seen status:", err);
        }
    }, [chats, currentUser?.id, changeChat]);

    // Memoize the filtered list so it only recalculates when chats or the deferred keystroke changes
    const filteredChats = useMemo(() => {
        const lowerInput = deferredInput.toLowerCase();
        return chats.filter((c) =>
            c.user.username.toLowerCase().includes(lowerInput)
        );
    }, [chats, deferredInput]);

    return (
        <div className="chatList">
            <div className="search">
                <div className="searchBar">
                    <img src="./search.png" alt="Search icon" />
                    <input
                        type="text"
                        placeholder="Search"
                        onChange={(e) => setInput(e.target.value)}
                        aria-label="Search chats"
                    />
                </div>
                <button
                    className="add"
                    onClick={() => setAddMode((prev) => !prev)}
                    aria-label={addMode ? "Close add user" : "Add user"}
                    aria-expanded={addMode}
                >
                    <img src={addMode ? "./minus.png" : "./plus.png"} alt="" />
                </button>
            </div>

            <div className="list-container">
                {filteredChats.map((chat) => (
                    <ChatItem
                        key={chat.chatId}
                        chat={chat}
                        currentUserId={currentUser.id}
                        onSelect={handleSelect}
                    />
                ))}
            </div>

            {/* Mount-Once Rule: Stays in the DOM. Toggled strictly via GPU CSS. */}
            <div
                className="add-user-overlay"
                data-visible={addMode}
                onClick={() => setAddMode(false)} /* Closes modal when clicking the dark background */
            >
                {/* e.stopPropagation() prevents the modal from closing when you click inside the form */}
                <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                    <AddUser />
                </div>
            </div>
        </div>
    );
};

export default ChatList;