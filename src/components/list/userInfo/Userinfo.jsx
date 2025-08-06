import "./userInfo.css"
import { useUserStore } from "../../../lib/userStore"
import { useState } from "react"
import upload from "../../../lib/upload"

const Userinfo = () => {

    const { currentUser, updateUser } = useUserStore();
    const [showModal, setShowModal] = useState(false);
    const [username, setUsername] = useState(currentUser.username);
    const [bio, setBio] = useState(currentUser.bio || "");
    const [avatar, setAvatar] = useState(null);

    const handleSave = async () => {
        try {
            let avatarUrl = currentUser.avatar;

            if (avatar) {
                avatarUrl = await upload(avatar);
            }

            await updateUser({
                avatar: avatarUrl,
                username: username,
                bio: bio,
            });

            setShowModal(false);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <>
            <div className="userInfo">
                <div className="user">
                    <img src={currentUser.avatar || "./avatar.png"} alt="" />
                    <h2>{currentUser.username}</h2>
                </div>
                <div className="icons">
                    <img src="./edit.png" alt="" onClick={() => setShowModal(true)} />
                </div>
            </div>

            {showModal && (
                <div className="modal">
                    <div className="modalContent">
                        <h3>Edit Profile</h3>

                        <label>
                            Profile Picture:
                            <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files[0])} />
                        </label>

                        <label>
                            Username:
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                        </label>

                        <label>
                            Bio / Status:
                            <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} />
                        </label>

                        <div className="buttons">
                            <button onClick={handleSave}>Save</button>
                            <button onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Userinfo