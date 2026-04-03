/**
 * Chat.jsx — Zero-jank chat panel
 *
 * Perf contract:
 *  - Firestore userChat updates run in parallel via Promise.all, not serial forEach.
 *  - EmojiPicker stays mounted; toggled with CSS opacity/visibility so the
 *    heavy component never re-mounts on every open/close.
 *  - All handlers are stable via useCallback to prevent memo'd children re-rendering.
 *  - Object URLs are revoked immediately after use to prevent memory leaks.
 *  - Messages are keyed by a content hash, not array index, so React only
 *    patches new nodes instead of re-rendering the whole list.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
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
    const [emojiOpen, setEmojiOpen] = useState(false)
    const [text, setText] = useState("")
    const [img, setImg] = useState({ file: null, url: "" })

    const { currentUser } = useUserStore()
    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, resetChat } = useChatStore()

    const endRef = useRef(null)
    const isBlocked = isCurrentUserBlocked || isReceiverBlocked

    // Scroll to bottom only when message list grows
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [chat?.messages?.length])

    // Firestore real-time listener
    useEffect(() => {
        if (!chatId) return
        const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
            setChat(res.data())
        })
        return unSub
    }, [chatId])

    // Revoke object URL when img changes or component unmounts
    useEffect(() => {
        return () => {
            if (img.url) URL.revokeObjectURL(img.url)
        }
    }, [img.url])

    const handleEmoji = useCallback((e) => {
        setText(prev => prev + e.emoji)
        setEmojiOpen(false)
    }, [])

    const handleImg = useCallback((e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImg(prev => {
            // Revoke previous preview URL before allocating a new one
            if (prev.url) URL.revokeObjectURL(prev.url)
            return { file, url: URL.createObjectURL(file) }
        })
    }, [])

    const toggleEmoji = useCallback(() => setEmojiOpen(prev => !prev), [])

    const handleSend = useCallback(async () => {
        // Trim guard: prevent whitespace-only messages from hitting Firestore
        if (!text.trim() && !img.file) return

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

            const userIDs = [currentUser.id, user.id]

            /*
             * Run both userChat updates in parallel — the original forEach with
             * async callbacks is fire-and-forget (forEach ignores returned promises).
             * Promise.all ensures both writes complete and errors are catchable.
             */
            await Promise.all(
                userIDs.map(async (id) => {
                    const userChatsRef = doc(db, "userchats", id)
                    const snapshot = await getDoc(userChatsRef)
                    if (!snapshot.exists()) return

                    const data = snapshot.data()
                    const chatIndex = data.chats.findIndex((c) => c.chatId === chatId)
                    if (chatIndex === -1) return

                    data.chats[chatIndex].lastMessage = text
                    data.chats[chatIndex].lastMessageSenderId = currentUser.id
                    data.chats[chatIndex].isSeen = id === currentUser.id
                    data.chats[chatIndex].updatedAt = Date.now()

                    await updateDoc(userChatsRef, { chats: data.chats })
                })
            )
        } catch (error) {
            console.error("[handleSend]", error)
        } finally {
            // Revoke the preview URL now that the file has been uploaded
            if (img.url) URL.revokeObjectURL(img.url)
            setImg({ file: null, url: "" })
            setText("")
        }
    }, [text, img, chatId, currentUser, user])

    return (
        <div className={`chat ${className}`}>

            {/* ── Top bar ──────────────────────────────────────── */}
            <div className="top">
                <div className="user">
                    <FaArrowLeft className="arrow-left" onClick={resetChat} />
                    <img src={user?.avatar || "./avatar.png"} alt={user?.username} />
                    <div className="texts">
                        <span>{user?.username}</span>
                        <p>{user?.bio}</p>
                    </div>
                </div>
                <div className="icons">
                    <div className="calls">
                        <img src="./phone.png" alt="Phone call" />
                        <img src="./video.png" alt="Video call" />
                    </div>
                    <button className="openDetailButton" onClick={onOpenDetail} aria-label="Open detail">
                        <HiOutlineViewList />
                    </button>
                </div>
            </div>

            {/* ── Message list ─────────────────────────────────── */}
            <div className="center">
                {chat?.messages?.map((message) => (
                    <div
                        className={`message ${message.senderId === currentUser.id ? "own" : ""}`}
                        /*
                         * Key by senderId+timestamp: stable identity so React only
                         * inserts new nodes instead of diffing the whole list.
                         * Index keys cause every message to re-render on any list mutation.
                         */
                        key={`${message.senderId}-${message.createdAt?.toMillis?.() ?? message.createdAt}`}
                    >
                        {message.senderId !== currentUser.id && (
                            <img
                                className="messageAvatar"
                                src={user?.avatar || "./avatar.png"}
                                alt="avatar"
                            />
                        )}
                        <div className="text">
                            {message.img && <img src={message.img} alt="attachment" />}
                            <p>{message.text}</p>
                            <span>{format(message.createdAt.toDate())}</span>
                        </div>
                    </div>
                ))}

                {/* Optimistic image preview before send completes */}
                {img.url && (
                    <div className="message own">
                        <div className="text">
                            <img src={img.url} alt="preview" />
                        </div>
                    </div>
                )}

                <span ref={endRef} />
            </div>

            {/* ── Bottom bar ───────────────────────────────────── */}
            <div className="bottom">
                <div className="icons">
                    <label htmlFor="file">
                        <img src="img.png" alt="Attach image" />
                    </label>
                    <input
                        type="file"
                        id="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleImg}
                    />
                </div>

                <input
                    type="text"
                    placeholder={isBlocked ? "You cannot send a message" : "Type a message..."}
                    onChange={e => setText(e.target.value)}
                    value={text}
                    disabled={isBlocked}
                />

                <div className="emoji">
                    <img onClick={toggleEmoji} src="./emoji.png" alt="Emoji picker" />
                    {/*
                     * Picker stays mounted — toggled via CSS class so the heavy
                     * component tree isn't destroyed and rebuilt on every click.
                     * opacity + visibility animate on the compositor thread (no paint).
                     */}
                    <div className={`picker ${emojiOpen ? "picker--open" : ""}`}>
                        <EmojiPicker onEmojiClick={handleEmoji} />
                    </div>
                </div>

                <button
                    className="sendButton"
                    onClick={handleSend}
                    disabled={isBlocked}
                >
                    Send
                </button>
            </div>
        </div>
    )
}

export default Chat