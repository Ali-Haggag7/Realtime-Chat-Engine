/**
 * Login.jsx — Zero-jank auth slider
 *
 * Perf contract:
 *  - All animations run on the Compositor thread (transform + opacity only).
 *  - JS touches the DOM exactly once per interaction: a single CSS custom
 *    property write. No style object allocation per render.
 *  - Touch detection is decoupled from React state via refs so the listener
 *    never re-registers on resize.
 *  - Object URLs are revoked on unmount to prevent memory leaks.
 */

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { toast } from "react-toastify";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import upload from "../../lib/upload";
import "./login.css";

// ---------------------------------------------------------------------------
// Sub-components — memo-wrapped so parent state changes don't cascade
// ---------------------------------------------------------------------------

const SignInForm = memo(({ loading, onSubmit, onSwitch }) => (
    <div className="login-item">
        <h2>Welcome back,</h2>
        <form onSubmit={onSubmit}>
            <input type="email" placeholder="Email" name="email" required />
            <input type="password" placeholder="Password" name="password" required />
            <button type="submit" disabled={loading}>
                {loading ? "Loading…" : "Sign In"}
            </button>
            <span className="formSwitch">
                Don't have an account?{" "}
                <span className="form-switch-link" onClick={onSwitch}>
                    Sign up
                </span>
            </span>
        </form>
    </div>
));
SignInForm.displayName = "SignInForm";

const SignUpForm = memo(({ loading, avatar, onAvatarChange, onSubmit, onSwitch }) => (
    <div className="login-item">
        <h2>Create an Account</h2>
        <form onSubmit={onSubmit}>
            <label htmlFor="file">
                <img src={avatar.url || "./avatar.png"} alt="Avatar preview" />
                Upload an image
            </label>
            <input
                type="file"
                id="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onAvatarChange}
            />
            <input type="text" placeholder="Username" name="username" required />
            <input type="email" placeholder="Email" name="email" required />
            <input type="password" placeholder="Password" name="password" required />
            <button type="submit" disabled={loading}>
                {loading ? "Loading…" : "Sign Up"}
            </button>
            <span className="formSwitch">
                Already have an account?{" "}
                <span className="form-switch-link" onClick={onSwitch}>
                    Sign in
                </span>
            </span>
        </form>
    </div>
));
SignUpForm.displayName = "SignUpForm";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const Login = () => {
    const [avatar, setAvatar] = useState({ file: null, url: "" });
    const [loginLoading, setLoginLoading] = useState(false);
    const [registerLoading, setRegisterLoading] = useState(false);
    // Single boolean is cheaper to compare than string equality on every render.
    const [isRegister, setIsRegister] = useState(false);

    const sliderRef = useRef(null);

    // ------------------------------------------------------------------
    // CSS-variable-driven slide — only ONE property write per interaction.
    // The browser compositor handles the rest; zero layout / paint work.
    // ------------------------------------------------------------------
    useEffect(() => {
        sliderRef.current?.style.setProperty("--slide", isRegister ? "1" : "0");
    }, [isRegister]);

    // ------------------------------------------------------------------
    // Touch swipe — registered once, reads state via ref to avoid stale closure.
    // NOT re-registered on every render (old code did this via windowWidth dep).
    // ------------------------------------------------------------------
    useEffect(() => {
        const slider = sliderRef.current;
        if (!slider) return;

        let touchStartX = 0;

        const onTouchStart = (e) => {
            touchStartX = e.changedTouches[0].screenX;
        };

        const onTouchEnd = (e) => {
            const diff = touchStartX - e.changedTouches[0].screenX;
            // 50px threshold filters noise from vertical scrolls.
            if (Math.abs(diff) > 50) {
                setIsRegister(diff > 0);
            }
        };

        // passive: true tells the browser this handler never calls preventDefault,
        // unblocking the scroll compositor thread entirely.
        slider.addEventListener("touchstart", onTouchStart, { passive: true });
        slider.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            slider.removeEventListener("touchstart", onTouchStart);
            slider.removeEventListener("touchend", onTouchEnd);
        };
    }, []); // ← empty: register once, never re-attach

    // ------------------------------------------------------------------
    // Revoke object URL on change/unmount to prevent memory leak.
    // ------------------------------------------------------------------
    useEffect(() => {
        return () => {
            if (avatar.url) URL.revokeObjectURL(avatar.url);
        };
    }, [avatar.url]);

    // ------------------------------------------------------------------
    // Stable callbacks — useCallback ensures memo'd children never re-render
    // due to handler identity changes.
    // ------------------------------------------------------------------

    const showRegister = useCallback(() => setIsRegister(true), []);
    const showLogin = useCallback(() => setIsRegister(false), []);

    const handleAvatar = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatar((prev) => {
            // Revoke previous URL before creating a new one.
            if (prev.url) URL.revokeObjectURL(prev.url);
            return { file, url: URL.createObjectURL(file) };
        });
    }, []);

    const handleLogin = useCallback(
        async (e) => {
            e.preventDefault();
            if (loginLoading) return;
            setLoginLoading(true);

            const data = new FormData(e.currentTarget);
            const email = data.get("email");
            const password = data.get("password");

            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (err) {
                toast.error(err?.message ?? "Login failed");
            } finally {
                setLoginLoading(false);
            }
        },
        [loginLoading]
    );

    const handleRegister = useCallback(
        async (e) => {
            e.preventDefault();
            if (registerLoading) return;
            setRegisterLoading(true);

            const data = new FormData(e.currentTarget);
            const username = data.get("username");
            const email = data.get("email");
            const password = data.get("password");

            try {
                const res = await createUserWithEmailAndPassword(auth, email, password);
                const imgUrl = await upload(avatar.file);

                await setDoc(doc(db, "users", res.user.uid), {
                    username,
                    email,
                    avatar: imgUrl,
                    id: res.user.uid,
                    blocked: [],
                });

                await setDoc(doc(db, "userChats", res.user.uid), { chats: [] });

                toast.success("Account created! You can log in now.");
                setIsRegister(false);
            } catch (err) {
                toast.error(err?.message ?? "Registration failed");
            } finally {
                setRegisterLoading(false);
            }
        },
        [registerLoading, avatar.file]
    );

    return (
        <div className="login">
            {/*
       * The slider's position is driven purely by --slide CSS custom property.
       * will-change: transform tells the browser to promote this layer to the
       * GPU ahead of time, eliminating the compositor promotion jank on first
       * interaction.
       */}
            <div className="slider" ref={sliderRef}>
                <SignInForm
                    loading={loginLoading}
                    onSubmit={handleLogin}
                    onSwitch={showRegister}
                />
                <SignUpForm
                    loading={registerLoading}
                    avatar={avatar}
                    onAvatarChange={handleAvatar}
                    onSubmit={handleRegister}
                    onSwitch={showLogin}
                />
            </div>
        </div>
    );
};

export default Login;