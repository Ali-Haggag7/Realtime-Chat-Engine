import { useEffect, useRef, useState } from 'react'
import './chat.css'
import EmojiPicker from 'emoji-picker-react'
import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useChatStore } from '../../lib/chatStore'
import { useUserStore } from '../../lib/userStore'
import upload from "../../lib/upload"
import { format } from "timeago.js"
import { FaArrowLeft } from "react-icons/fa"
import { HiOutlineViewList } from "react-icons/hi"

const Chat = ({ className, onOpenDetail }) => {

    const [chat, setChat] = useState()
    const [open, setOpen] = useState(false)
    const [text, setText] = useState("")
    const [img, setImg] = useState({
        file: null,
        url: "",
    })

    const { currentUser } = useUserStore()
    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, resetChat } = useChatStore()

    const endRef = useRef(null)

    // Handle Scroll
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [chat?.messages])

    useEffect(() => {
        const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
            setChat(res.data())
        })

        return () => {
            unSub()
        };
    }, [chatId])

    const handleEmoji = e => {
        setText(text + e.emoji)
        setOpen(false)
    }

    const handleImg = (e) => {
        if (e.target.files[0]) {
            setImg({
                file: e.target.files[0],
                url: URL.createObjectURL(e.target.files[0]),
            })
        }
    }

    const handleSend = async () => {
        if (text === "") return

        let imgUrl = null

        try {
            if (img.file) {
                imgUrl = await upload(img.file)
            }

            await updateDoc(doc(db, "chats", chatId), {
                messages: arrayUnion({
                    senderId: currentUser.id,
                    text,
                    createdAt: new Date(),
                    ...(imgUrl && { img: imgUrl }),
                }),
            })

            const userIDs = [currentUser.id, user.id];

            userIDs.forEach(async (id) => {
                const userChatsRef = doc(db, "userchats", id);
                const userChatsSnapshot = await getDoc(userChatsRef);

                if (userChatsSnapshot.exists()) {
                    const userChatsData = userChatsSnapshot.data();

                    const chatIndex = userChatsData.chats.findIndex(
                        (c) => c.chatId === chatId
                    );

                    userChatsData.chats[chatIndex].lastMessage = text;
                    userChatsData.chats[chatIndex].lastMessageSenderId = currentUser.id; // <-- اضفت السطر ده
                    userChatsData.chats[chatIndex].isSeen = id === currentUser.id ? true : false;
                    userChatsData.chats[chatIndex].updatedAt = Date.now();

                    await updateDoc(userChatsRef, {
                        chats: userChatsData.chats,
                    });
                }
            });

        } catch (error) {
            console.log(error)
        }

        finally {
            setImg({
                file: null,
                url: "",
            });

            setText("")
        }
    }

    return (
        <div className={`chat ${className}`}>
            <div className="top">  {/* top */}
                <div className="user">
                    <FaArrowLeft className="arrow-left" onClick={resetChat} />
                    <img src={user?.avatar || "./avatar.png"} alt="" />
                    <div className="texts">
                        <span>{user?.username}</span>
                        <p>{user?.bio}</p>
                    </div>
                </div>
                <div className="icons">
                    <div className="calls">
                        <img src="./phone.png" alt="" />
                        <img src="./video.png" alt="" />
                    </div>
                    <button
                        className="openDetailButton"
                        onClick={onOpenDetail}
                    >
                        <HiOutlineViewList />
                    </button>
                </div>
            </div>
            <div className="center">  {/* center */}
                {chat?.messages?.map((message, index) => (
                    <div className={`message ${message.senderId === currentUser.id ? "own" : ""}`} key={index}>
                        {message.senderId !== currentUser.id && (
                            <img
                                className="messageAvatar"
                                src={user?.avatar || "./avatar.png"}
                                alt="avatar"
                            />
                        )}
                        <div className="text">
                            {message.img && <img src={message.img} alt="" />}
                            <p>{message.text}</p>
                            <span>{format(message.createdAt.toDate())}</span>
                        </div>
                    </div>
                ))}
                {img.url && (
                    <div className="message own">
                        <div className="text">
                            <img src={img.url} alt="" />
                        </div>
                    </div>
                )}
                <div ref={endRef}></div>
            </div>
            <div className="bottom">  {/* bottom */}
                <div className="icons">
                    <label htmlFor="file">
                        <img src="img.png" alt="" />
                    </label>
                    <input type="file" id='file' style={{ display: "none" }} onChange={handleImg} />
                    {/* <img src="camera.png" alt="" />
                    <img src="mic.png" alt="" /> */}
                </div>
                <input
                    type="text"
                    placeholder={
                        isCurrentUserBlocked || isReceiverBlocked
                            ? "You cannot send a message"
                            : "Type a message..."
                    }
                    onChange={e => setText(e.target.value)}
                    value={text}
                    disabled={isCurrentUserBlocked || isReceiverBlocked}
                />
                <div className="emoji">
                    <img onClick={() => setOpen(!open)} src="./emoji.png" alt="" />
                    <div className="picker">
                        {open ? <EmojiPicker onEmojiClick={handleEmoji} /> : ""}
                    </div>
                </div>
                <button className="sendButton" onClick={handleSend} disabled={isCurrentUserBlocked || isReceiverBlocked}>Send</button>
            </div>
        </div>
    )
}

export default Chat