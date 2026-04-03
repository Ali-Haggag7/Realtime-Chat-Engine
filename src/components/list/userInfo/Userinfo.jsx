/**
 * Userinfo.jsx — User info bar + edit profile modal
 *
 * Perf contract:
 *  - Modal stays mounted; toggled via CSS opacity + visibility + transform
 *    so the input DOM is never destroyed/recreated between opens.
 *  - All handlers are stable via useCallback.
 *  - isSaving guard prevents concurrent upload calls on spam-click.
 *  - Avatar preview URL is revoked on change and on modal close to prevent leaks.
 *  - useEffect syncs local state if currentUser updates externally post-save.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useUserStore } from "../../../lib/userStore"
import upload from "../../../lib/upload"
import "./userInfo.css"

const Userinfo = () => {
    const { currentUser, updateUser } = useUserStore()

    const [showModal, setShowModal] = useState(false)
    const [username, setUsername] = useState(currentUser.username)
    const [bio, setBio] = useState(currentUser.bio || "")
    const [avatarFile, setAvatarFile] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    // Revoke object URL ref so we can clean up in multiple places
    const previewUrlRef = useRef(null)

    // Sync local fields if the store updates externally (e.g. after save)
    useEffect(() => {
        setUsername(currentUser.username)
        setBio(currentUser.bio || "")
    }, [currentUser.username, currentUser.bio])

    const revokePreview = useCallback(() => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = null
        }
    }, [])

    const handleAvatarChange = useCallback((e) => {
        const file = e.target.files?.[0]
        if (!file) return
        revokePreview()
        const url = URL.createObjectURL(file)
        previewUrlRef.current = url
        setAvatarFile(file)
        setAvatarPreview(url)
    }, [revokePreview])

    const handleClose = useCallback(() => {
        // Reset unsaved changes when dismissing
        setUsername(currentUser.username)
        setBio(currentUser.bio || "")
        setAvatarFile(null)
        setAvatarPreview(null)
        revokePreview()
        setShowModal(false)
    }, [currentUser.username, currentUser.bio, revokePreview])

    const handleOpen = useCallback(() => setShowModal(true), [])

    const handleSave = useCallback(async () => {
        // Guard against concurrent saves on rapid clicks
        if (isSaving) return
        setIsSaving(true)
        try {
            let avatarUrl = currentUser.avatar
            if (avatarFile) {
                avatarUrl = await upload(avatarFile)
                revokePreview()
            }
            await updateUser({ avatar: avatarUrl, username, bio })
            setAvatarFile(null)
            setAvatarPreview(null)
            setShowModal(false)
        } catch (err) {
            console.error("[handleSave]", err)
        } finally {
            setIsSaving(false)
        }
    }, [isSaving, avatarFile, username, bio, currentUser.avatar, updateUser, revokePreview])

    // Cleanup preview URL on unmount
    useEffect(() => revokePreview, [revokePreview])

    return (
        <>
            <div className="userInfo">
                <div className="user">
                    <img src={currentUser.avatar || "./avatar.png"} alt={currentUser.username} />
                    <h2>{currentUser.username}</h2>
                </div>
                <div className="icons">
                    <img
                        src="./edit.png"
                        alt="Edit profile"
                        onClick={handleOpen}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
                    />
                </div>
            </div>

            {/*
             * Modal stays mounted — visibility controlled by CSS class.
             * This avoids destroying/recreating the input DOM subtree on every
             * open/close, and allows the enter/exit transition to actually run.
             * pointer-events: none when hidden prevents invisible click interception.
             */}
            <div
                className={`modal ${showModal ? "modal--open" : ""}`}
                onClick={handleClose}
                aria-modal="true"
                role="dialog"
            >
                <div
                    className="modalContent"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3>Edit Profile</h3>

                    <label>
                        Profile Picture
                        <div className="avatarPreviewRow">
                            <img
                                className="avatarPreview"
                                src={avatarPreview || currentUser.avatar || "./avatar.png"}
                                alt="Avatar preview"
                            />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                            />
                        </div>
                    </label>

                    <label>
                        Username
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </label>

                    <label>
                        Bio / Status
                        <input
                            type="text"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                        />
                    </label>

                    <div className="buttons">
                        <button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving…" : "Save"}
                        </button>
                        <button onClick={handleClose} disabled={isSaving}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Userinfo