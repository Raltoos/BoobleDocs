import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import DashHeader from "../components/DashHeader";

const Wrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");

  const handleAuth = async () => {
    try {
      const res = await fetch("http://localhost:3000/check", {
        credentials: "include",
      });

      const data = await res.json();
      console.log(data);

      if (data.message === "false") {
        navigate("/");
      }

      setUsername(data.username);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    handleAuth();
  }, []);

  return (
    <div>
      {location.pathname === "/app" && <DashHeader username={username} />}
      <Outlet />
    </div>
  );
};

export default Wrapper;
