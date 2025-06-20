import { useEffect, useState } from "react";
import "./App.css";
import Home from "./components/Home";
import { Login } from "./components/Login";
import { api } from "./libs/axios";
// import { api } from "./libs/axios";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const checkAuth = async () => {
    try {
      const data = await api.protected.getMe();
      setUser(data.user.name);
      setIsLoggedIn(!!data.isLoggedIn);
    } catch (e) {
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleMessage = (message: any) => {
      if (message.type === "CHECK_AUTH_STATUS") {
        checkAuth();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return <div>{isLoggedIn ? <Home name={user} /> : <Login />}</div>;
}

export default App;
