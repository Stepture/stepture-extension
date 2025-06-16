import { useEffect, useState } from "react";
import "./App.css";
import Home from "./components/Home";
import { Login } from "./components/Login";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await fetch(
        import.meta.env.VITE_BACKEND_URL + `/auth/session`,
        {
          method: "GET",
          credentials: "include",
        }
      );
      const data = await res.json();
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

  return <div>{isLoggedIn ? <Home /> : <Login />}</div>;
}

export default App;
