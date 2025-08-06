// Login.jsx

import { useState, useEffect } from "react"
import "./login.css"
import { toast } from "react-toastify"
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "firebase/auth"
import { auth, db } from "../../lib/firebase"
import { doc, setDoc } from "firebase/firestore"
import upload from "../../lib/upload"

const Login = () => {
    const [avatar, setAvatar] = useState({ file: null, url: "" })
    const [loading, setLoading] = useState(false)
    const [activeForm, setActiveForm] = useState("login")
    const [windowWidth, setWindowWidth] = useState(window.innerWidth)

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth)
        }

        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    useEffect(() => {
        let touchStartX = 0
        let touchEndX = 0

        const handleTouchStart = (e) => {
            touchStartX = e.changedTouches[0].screenX
        }

        const handleTouchEnd = (e) => {
            touchEndX = e.changedTouches[0].screenX
            const diff = touchStartX - touchEndX

            if (Math.abs(diff) > 50) {
                setActiveForm(diff > 0 ? "register" : "login")
            }
        }

        const slider = document.querySelector(".slider")
        if (slider && windowWidth <= 768) {
            slider.addEventListener("touchstart", handleTouchStart)
            slider.addEventListener("touchend", handleTouchEnd)
        }

        return () => {
            if (slider) {
                slider.removeEventListener("touchstart", handleTouchStart)
                slider.removeEventListener("touchend", handleTouchEnd)
            }
        }
    }, [windowWidth])

    const handleAvatar = (e) => {
        if (e.target.files[0]) {
            setAvatar({
                file: e.target.files[0],
                url: URL.createObjectURL(e.target.files[0])
            })
        }
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.target)
        const { username, email, password } = Object.fromEntries(formData)

        try {
            const res = await createUserWithEmailAndPassword(auth, email, password)
            const imgUrl = await upload(avatar.file)

            await setDoc(doc(db, "users", res.user.uid), {
                username,
                email,
                avatar: imgUrl,
                id: res.user.uid,
                blocked: []
            })

            await setDoc(doc(db, "userChats", res.user.uid), {
                chats: []
            })

            toast.success("Account created! You can login now!")
            setActiveForm("login")
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.target)
        const { email, password } = Object.fromEntries(formData)

        try {
            await signInWithEmailAndPassword(auth, email, password)
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login">
            <div
                className="slider"
                style={{
                    transform:
                        windowWidth <= 768
                            ? activeForm === "login"
                                ? "translateX(0vw)"
                                : "translateX(-100vw)"
                            : activeForm === "login"
                                ? "translateX(0%)"
                                : "translateX(-50%)"
                }}
            >
                {/* Sign In Form */}
                <div className="item">
                    <h2>Welcome back,</h2>
                    <form onSubmit={handleLogin}>
                        <input type="email" placeholder="Email" name="email" required />
                        <input type="password" placeholder="Password" name="password" required />
                        <button disabled={loading}>{loading ? "Loading" : "Sign In"}</button>
                        <span className="formSwitch">
                            Don't have an account? <span className="sign-up-switch" onClick={() => setActiveForm("register")}>Sign up</span>
                        </span>
                    </form>
                </div>

                {/* Sign Up Form */}
                <div className="item">
                    <h2>Create An Account</h2>
                    <form onSubmit={handleRegister}>
                        <label htmlFor="file">
                            <img src={avatar.url || "./avatar.png"} alt="avatar" />
                            Upload an image
                        </label>
                        <input type="file" id="file" style={{ display: "none" }} onChange={handleAvatar} />
                        <input type="text" placeholder="Username" name="username" required />
                        <input type="email" placeholder="Email" name="email" required />
                        <input type="password" placeholder="Password" name="password" required />
                        <button disabled={loading}>{loading ? "Loading" : "Sign Up"}</button>
                        <span className="formSwitch">
                            Already have an account? <span className="sign-in-switch" onClick={() => setActiveForm("login")}>Sign in</span>
                        </span>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Login