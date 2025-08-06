import List from "./components/list/List"
import Chat from "./components/chat/Chat"
import Detail from "./components/detail/Detail"
import Login from "./components/login/Login"
import Notification from "./components/notification/Notification"
import { useEffect, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"  // استيراد signOut
import { auth } from "./lib/firebase"
import { useUserStore } from "./lib/userStore"
import { useChatStore } from "./lib/chatStore"

const App = () => {
  const { currentUser, isloading, fetchUserInfo } = useUserStore()
  const { chatId } = useChatStore()

  const [detailOpen, setDetailOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024)

  useEffect(() => {
    const onSub = onAuthStateChanged(auth, (user) => {
      fetchUserInfo(user?.uid)
    })

    return () => {
      onSub()
    }
  }, [fetchUserInfo])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  if (isloading) return <div className="loading">Loading...</div>

  return (
    <div className='container'>
      {currentUser ? (
        <>
          {/* الشاشات الصغيرة */}
          {isMobile ? (
            <>
              {!chatId ? (
                <List />
              ) : (
                <>
                  <Chat className="active" onOpenDetail={() => setDetailOpen(true)} />
                  <Detail className={detailOpen ? "active" : ""} onClose={() => setDetailOpen(false)} />
                </>
              )}
            </>
          ) : (
            <>
              {/* الشاشات الكبيرة */}
              <List />
              {chatId ? (
                <>
                  <Chat className="active" onOpenDetail={() => setDetailOpen(true)} />
                  <Detail className={detailOpen ? "active" : ""} onClose={() => setDetailOpen(false)} />
                </>
              ) : (
                <div className="noChatSelected">
                  <p>Select a chat to start a conversation.</p>
                </div>
              )}
            </>
          )}
          {(!chatId || (isMobile && !chatId)) && (
            <button
              onClick={handleLogout}
              className="logoutButton"
              title="Logout"
            >
              Logout
            </button>
          )}
        </>
      ) : (
        <Login />
      )}
      <Notification />
    </div>
  )
}

export default App