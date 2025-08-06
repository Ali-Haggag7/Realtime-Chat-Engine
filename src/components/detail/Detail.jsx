import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc } from "firebase/firestore"
import { useChatStore } from "../../lib/chatStore"
import { auth, db } from "../../lib/firebase"
import { useUserStore } from "../../lib/userStore"
import "./detail.css"
import { useEffect, useState } from "react"
import { IoCloseCircle } from "react-icons/io5"

const Detail = ({ className, onClose }) => {

    const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock, resetChat } = useChatStore()
    const { currentUser } = useUserStore()

    const [sharedPhotos, setSharedPhotos] = useState([])
    const [showPhotos, setShowPhotos] = useState(true)

    useEffect(() => {
        if (!chatId) return

        const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
            const messages = res.data()?.messages || []

            // جلب الصور فقط
            const photos = messages
                .filter((m) => m.img)
                .map((m) => ({ url: m.img, timestamp: m.createdAt }))

            setSharedPhotos(photos)
        })

        return () => unSub()
    }, [chatId])

    const handleBlock = async () => {
        if (!user) return

        const userDocRef = doc(db, "users", currentUser.id)

        try {
            await updateDoc(userDocRef, {
                blocked: isReceiverBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
            })
            changeBlock()
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <div className={`detail ${className}`}>
            <div className="user">
                <img src={user?.avatar || "./avatar.png"} alt="" />
                <h2>{user?.username}</h2>
                <p>{user?.bio}</p>
                <button className="closeDetailBtn" onClick={onClose}>
                    <IoCloseCircle className="close-btn" />
                </button>
            </div>
            <div className="info">
                <div className="option">
                    <div className="title">
                        <span>Chat settings</span>
                        <img src="./arrowUp.png" alt="" />
                    </div>
                </div>
                <div className="option">
                    <div className="title">
                        <span>Privacy & help</span>
                        <img src="./arrowUp.png" alt="" />
                    </div>
                </div>
                <div className="option option-photo">
                    <div className="title" onClick={() => setShowPhotos((prev) => !prev)}>
                        <span>Shared photos</span>
                        <img
                            src="./arrowUp.png"
                            alt=""
                            className={`arrow ${showPhotos ? "rotate" : ""}`}
                        />
                    </div>
                    <div className={`photos ${showPhotos ? "open" : "closed"}`}>
                        {sharedPhotos.length > 0 ? (
                            sharedPhotos.map((photo, index) => (
                                <div className="photoItem" key={index}>
                                    <div className="photoDetail">
                                        <img src={photo.url} alt={`shared-${index}`} />
                                        <span>{`photo_${index + 1}`}</span>
                                    </div>
                                    <a href={photo.url} download>
                                        <img src="./download.png" alt="" className="icon" />
                                    </a>
                                </div>
                            ))
                        ) : (
                            <p className="no-photos">No shared photos</p>
                        )}
                    </div>
                </div>
                <div className="option">
                    <div className="title">
                        <span>Shared files</span>
                        <img src="./arrowUp.png" alt="" />
                    </div>
                </div>
            </div>
            <div className="stickyButtons">
                <button onClick={handleBlock} disabled={isCurrentUserBlocked}>
                    {isCurrentUserBlocked
                        ? "You are Blocked!"
                        : isReceiverBlocked
                            ? "User blocked"
                            : "Block User"}
                </button>
                <button className="logout" onClick={() => auth.signOut()}>
                    Logout
                </button>
            </div>
        </div>
    )
}

export default Detail