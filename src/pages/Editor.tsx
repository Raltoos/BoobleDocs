import { useState, useRef, useEffect } from "react";
import TextEditor from "../components/TextEditor";
import logo from "../logo.png";
import { useNavigate, useParams } from "react-router-dom";

const Editor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("Untitled Document");
  const [username, setUsername] = useState<string>("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDocumentTitle = async () => {
    try {
      const response = await fetch(`http://localhost:3000/doc/${id}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch document details");
      }

      const data = await response.json();
      setTitle(data.title || "Untitled Document");
    } catch (error) {
      console.error("Error fetching document title:", error);
    }
  };

  useEffect(() => {
    fetchDocumentTitle();
  }, [id]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
    }
  }, [editingTitle]);

  const handleTitleClick = () => {
    setEditingTitle(true);
  };

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (!title.trim()) {
      setTitle("Untitled Document");
    }

    try {
      const response = await fetch(`http://localhost:3000/doc/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error("Failed to update title");
      }

      const data = await response.json();
      console.log("Title updated:", data);
    } catch (error) {
      console.error("Error updating title:", error);
    }

    fetchDocumentTitle();
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <div className="w-full flex flex-col items-center mt-2">
        <div className="w-[90%] flex justify-between items-center gap-3">
          <div className="flex justify-start">
            <img
              src={logo}
              alt="google docs logo"
              className="w-[45px] cursor-pointer"
              onClick={() => navigate("/app")}
            />
            <div className="w-[90%] flex justify-start items-center gap-3">
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  className="text-lg border border-gray-400 px-1 outline-none focus:border-gray-400"
                />
              ) : (
                <div
                  className="text-lg hover:border-gray-400 hover:border px-1 cursor-pointer"
                  onClick={handleTitleClick}
                >
                  {title}
                </div>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl font-light">Hi, {username}</h1>
          </div>
        </div>
      </div>
      <TextEditor documentId={id} username={username} setUsername={setUsername}/>
    </div>
  );
};

export default Editor;
