/**
 * Detail.jsx — Chat detail / user info panel
 *
 * Perf contract:
 *  - Photo list is derived inside the snapshot callback with an early-exit
 *    ref guard so text-only message updates don't re-render the photo list.
 *  - handleBlock and togglePhotos are stable via useCallback.
 *  - Photo accordion uses the CSS grid-rows trick (0fr → 1fr) — the only
 *    accordion approach that never triggers layout recalc on the main thread.
 *  - Panel slide-in uses transform + visibility (compositor-only).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc } from "firebase/firestore"
import { IoCloseCircle } from "react-icons/io5"
import { useChatStore } from "../../lib/chatStore"
import { auth, db } from "../../lib/firebase"
import { useUserStore } from "../../lib/userStore"
import "./detail.css"

const Detail = ({ className, onClose }) => {
    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock } = useChatStore()
    const { currentUser } = useUserStore()

    const [sharedPhotos, setSharedPhotos] = useState([])
    const [showPhotos, setShowPhotos] = useState(true)

    // Track previous photo count so text-only Firestore updates skip setState
    const prevPhotoCountRef = useRef(0)

    useEffect(() => {
        if (!chatId) return

        const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
            const messages = res.data()?.messages ?? []
            const photos = messages
                .filter((m) => m.img)
                .map((m) => ({ url: m.img, timestamp: m.createdAt }))

            // Skip re-render if only text messages changed
            if (photos.length === prevPhotoCountRef.current) return
            prevPhotoCountRef.current = photos.length
            setSharedPhotos(photos)
        })

        return () => unSub()
    }, [chatId])

    const handleBlock = useCallback(async () => {
        if (!user) return
        try {
            await updateDoc(doc(db, "users", currentUser.id), {
                blocked: isReceiverBlocked
                    ? arrayRemove(user.id)
                    : arrayUnion(user.id),
            })
            changeBlock()
        } catch (err) {
            console.error("[handleBlock]", err)
        }
    }, [user, currentUser.id, isReceiverBlocked, changeBlock])

    const togglePhotos = useCallback(() => setShowPhotos((prev) => !prev), [])
    const handleLogout = useCallback(() => auth.signOut(), [])

    return (
        <div className={`detail ${className}`}>

            {/* ── User card ─────────────────────────────────── */}
            <div className="user">
                <img
                    src={user?.avatar || "./avatar.png"}
                    alt={user?.username}
                    width={100}
                    height={100}
                />
                <h2>{user?.username}</h2>
                <p>{user?.bio}</p>
                <button className="closeDetailBtn" onClick={onClose} aria-label="Close detail">
                    <IoCloseCircle />
                </button>
            </div>

            {/* ── Info / options ────────────────────────────── */}
            <div className="info">

                <div className="option">
                    <div className="title">
                        <span>Chat settings</span>
                        <img src="./arrowUp.png" alt="" aria-hidden="true" />
                    </div>
                </div>

                <div className="option">
                    <div className="title">
                        <span>Privacy &amp; help</span>
                        <img src="./arrowUp.png" alt="" aria-hidden="true" />
                    </div>
                </div>

                {/* Shared photos accordion */}
                <div className="option option-photo">
                    <div className="title" onClick={togglePhotos}>
                        <span>Shared photos</span>
                        <img
                            src="./arrowUp.png"
                            alt=""
                            aria-hidden="true"
                            className={`arrow ${showPhotos ? "rotate" : ""}`}
                        />
                    </div>

                    {/*
                     * grid-rows accordion: animating grid-template-rows: 0fr → 1fr
                     * never triggers layout recalc — the browser resolves it on the
                     * compositor. max-height transitions force a full layout pass
                     * every frame because the browser must measure the content height.
                     */}
                    <div className={`photos ${showPhotos ? "open" : ""}`}>
                        <div className="photos-inner">
                            {sharedPhotos.length > 0 ? (
                                sharedPhotos.map((photo) => (
                                    <div className="photoItem" key={photo.url}>
                                        <div className="photoDetail">
                                            <img
                                                src={photo.url}
                                                alt="shared"
                                                width={40}
                                                height={40}
                                            />
                                            <span>{photo.url.split("/").pop().split("?")[0]}</span>
                                        </div>
                                        <a href={photo.url} download aria-label="Download photo">
                                            <img src="./download.png" alt="" className="icon" aria-hidden="true" />
                                        </a>
                                    </div>
                                ))
                            ) : (
                                <p className="no-photos">No shared photos</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="option">
                    <div className="title">
                        <span>Shared files</span>
                        <img src="./arrowUp.png" alt="" aria-hidden="true" />
                    </div>
                </div>
            </div>

            {/* ── Sticky action buttons ─────────────────────── */}
            <div className="stickyButtons">
                <button onClick={handleBlock} disabled={isCurrentUserBlocked}>
                    {isCurrentUserBlocked
                        ? "You are Blocked!"
                        : isReceiverBlocked
                            ? "User blocked"
                            : "Block User"}
                </button>
                <button className="logout" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </div>
    )
}

export default Detail