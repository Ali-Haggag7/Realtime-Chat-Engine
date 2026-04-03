import { memo } from "react";
import "./list.css";
import Userinfo from "./userInfo/Userinfo";
import ChatList from "./chatList/ChatList";

// Memoized purely presentational wrapper. 
// Prevents global state changes from re-rendering the heavy ChatList tree.
const List = memo(() => {
    return (
        <aside className="list" aria-label="Sidebar navigation">
            <Userinfo />
            <ChatList />
        </aside>
    );
});
List.displayName = "List";

export default List;