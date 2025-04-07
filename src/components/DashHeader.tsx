import { useRef, useState } from "react";
import logo from "../logo.png";
import { IoMdSearch } from "react-icons/io";
import useClickOutside from "../hooks/useClickOutside";
import { useNavigate } from "react-router-dom";

const DashHeader = ({ username }: { username: string | null }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const navigate = useNavigate();
  useClickOutside(menuRef, () => setOptionsOpen(false));

  const handleLogout = async () => {
    const response = await fetch("http://localhost:3000/user/logout", {
      method: "POST",
      credentials: "include"
    })

    if(response.ok) navigate("/");
    else console.log(response);
  }

  return (
    <div className="w-full flex flex-col items-center mt-2">
      <div className="w-full flex items-center justify-between px-10">
        <div className="flex gap-3 items-center">
          <img src={logo} alt="google docs logo" className="w-[45px]" />
          <h1 className="text-2xl font-light">BoobleDocs</h1>
        </div>

        <div className="w-[55%] flex items-center bg-gray-200 rounded-s-full rounded-e-full">
          <label htmlFor="" className="bg-gray-200 ps-4 rounded-s-full">
            <IoMdSearch className="size-6 text-gray-700" />
          </label>
          <input
            type="text"
            name=""
            id=""
            placeholder="Search"
            className="w-full bg-gray-200 py-2 px-4 rounded-e-full"
          />
        </div>

        <div className="flex gap-2 text-lg" ref={menuRef}>
          <div
            className="size-12 rounded-full bg-orange-500 text-white flex justify-center items-center text-lg font-medium cursor-pointer"
            onClick={() => setOptionsOpen((prev) => !prev)}
          >
            {username?.slice(0, 1).toUpperCase()}
          </div>

          {optionsOpen && (
            <div className="absolute right-0 top-14 mt-2 w-40 bg-white border border-gray-300 shadow-md rounded-md p-2 z-10">
              <ul className="flex flex-col items-center">
                <li className="p-2 cursor-pointer font-light">
                  <h1>Hi, {username}</h1>
                </li>
                <li className="p-2 hover:bg-gray-100 cursor-pointer text-sm" onClick={handleLogout}>
                  Log Out
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashHeader;
