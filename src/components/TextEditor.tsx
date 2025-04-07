import {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
  ClipboardEvent,
} from "react";
import { EditorDataModel } from "./EditorDataModel";
import { io, Socket } from "socket.io-client";
import { FaShare, FaTimes } from "react-icons/fa";

export interface CursorPosition {
  userId: string;
  username?: string;
  position: number;
  color: string;
}

interface TextOperation {
  type: "insert" | "delete";
  position: number;
  character?: string;
  userId: string;
}

const TextEditor = ({
  documentId,
  username,
  setUsername,
}: {
  documentId: string | undefined;
  username: string ;
  setUsername: React.Dispatch<React.SetStateAction<string | undefined>>;
}) => {
  const socketRef = useRef<Socket | null>(null);
  const documentLoadedRef = useRef(false);
  const operationsQueueRef = useRef<TextOperation[]>([]);

  const [text, setText] = useState("");
  const [otherCursors, setOtherCursors] = useState<CursorPosition[]>([]);
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState("Untitled Document");
  const [permission, setPermission] = useState("read");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState("");
  const [shareAccess, setShareAccess] = useState("read");
  const [shareStatus, setShareStatus] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<EditorDataModel | null>(null);

  const fontInfo = { width: 8, height: 18 };

  const userColor = useRef<string>(
    ["#FF5733", "#33FF57", "#3357FF", "#F033FF", "#33FFF0"][
      Math.floor(Math.random() * 5)
    ]
  ).current;

  const fetchUserDetails = async () => {
    const response = await fetch("http://localhost:3000/user/me", {
      credentials: "include",
    });

    const data = await response.json();

    setUserId(data.userId);
    setUsername(data.username);
  };

  useEffect(() => {
    fetchUserDetails();

    // Store for future use
    localStorage.setItem("userId", userId);
    localStorage.setItem("username", username);

    setEditor(new EditorDataModel(userId, documentId));
  }, [documentId]);

  useEffect(() => {
    if (editor) {
      setText(editor.getTextwithAllCursors(otherCursors));
    }
  }, [editor?.cursor_position, otherCursors, editor]);

  useEffect(() => {
    if (!editor || !userId) return;

    const initializeEditor = async () => {
      try {
        setIsLoading(true);

        // Socket connection
        socketRef.current = io("http://localhost:3000");

        setupSocketHandlers();
        const response = await fetch(
          `http://localhost:3000/doc/${documentId}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status}`);
        }

        const data = await response.json();
        console.log(data);

        editor.setText(data.content || "");
        setTitle(data.title || "Untitled Document");
        setPermission(data.permission || "read");

        // Set initial cursors from server
        if (data.cursors && Array.isArray(data.cursors)) {
          setOtherCursors(data.cursors.filter((c) => c.userId !== userId));
        }

        documentLoadedRef.current = true;

        processQueuedOperations();
        emitCursorPosition();
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing editor:", error);
        setIsLoading(false);
      }
    };

    const setupSocketHandlers = () => {
      const socket = socketRef.current;
      if (!socket) return;

      // Connection events
      socket.on("connect", () => {
        // Join document room
        socket.emit("join-document", {
          documentId,
          userId,
          username,
          color: userColor,
        });
      });

      // Document state event - initial load
      socket.on("document-state", (data) => {
        if (data.content) {
          editor.setText(data.content);
        }
        if (data.title) {
          setTitle(data.title);
        }
        if (data.cursors) {
          setOtherCursors(data.cursors.filter((c) => c.userId !== userId));
        }
      });

      // Listen for text operations from other users
      socket.on("text-operation", (operation: TextOperation) => {
        if (operation.userId !== userId) {
          // If document isn't loaded yet, queue the operation
          if (!documentLoadedRef.current) {
            operationsQueueRef.current.push(operation);
            return;
          }

          applyOperation(operation);
        }
      });

      // Listen for cursor updates from other users
      socket.on("cursor-update", (cursors: CursorPosition[]) => {
        setOtherCursors(cursors.filter((c) => c.userId !== userId));
      });

      // Listen for share results
      socket.on("share-result", (result) => {
        if (result.success) {
          setShareStatus(`Successfully shared with ${result.username}`);
          setTimeout(() => setIsShareDialogOpen(false), 2000);
        } else {
          setShareStatus(`Error: ${result.message}`);
        }
      });

      // Session expired notification
      socket.on("session-expired", () => {
        alert("Your session was opened in another window");
      });
    };

    initializeEditor();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [documentId, editor, userId, userColor]);

  const processQueuedOperations = () => {
    const operations = operationsQueueRef.current;
    operationsQueueRef.current = [];

    // Apply operations in sequence
    operations.forEach((operation) => {
      applyOperation(operation);
    });
  };

  const applyOperation = (operation: TextOperation) => {
    if (!editor) return;
  
    if (operation.type === "insert" && operation.character) {
      editor.insertChar(operation.character, operation.position, false);
    } else if (operation.type === "delete") {
      editor.deleteChar(operation.position, false);
    }
  
    setText(editor.getTextwithAllCursors(otherCursors));
    
    emitCursorPosition();
  }

  const emitCursorPosition = () => {
    if (!editor) return;

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("cursor-update", {
        userId,
        username,
        position: editor.cursor_position,
        color: userColor,
        documentId,
      });
    }
  };

  const emitTextOperation = (operation: TextOperation) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("text-operation", {
        ...operation,
        documentId,
      });
    }
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editor || permission === "read") return;

    let { key } = event;
    // key = key.toLowerCase();

    const currentPosition = editor.cursor_position;

    switch (key) {
      case "Backspace":
        if (currentPosition > 0) {
          editor.deleteChar(currentPosition - 1);
          editor.setCursorPosition(Math.max(0, currentPosition - 1));
          emitTextOperation({
            type: "delete",
            position: currentPosition - 1,
            userId,
          });
          emitCursorPosition();
        }
        break;

      case "Tab":
        event.preventDefault();
        for (let index = 0; index < 2; index++) {
          editor.insertChar(" ", currentPosition + index);
          emitTextOperation({
            type: "insert",
            position: currentPosition + index,
            character: " ",
            userId,
          });
        }
        editor.setCursorPosition(currentPosition + 2);
        break;

      case "Enter":
        editor.insertChar("\n", currentPosition);
        editor.setCursorPosition(currentPosition + 1);
        emitTextOperation({
          type: "insert",
          position: currentPosition,
          character: "\n",
          userId,
        });
        break;

      case "ArrowUp":
        event.preventDefault();
        editor.moveCursorUp();
        break;

      case "ArrowDown":
        event.preventDefault();
        editor.moveCursorDown();
        break;

      case "ArrowLeft":
        editor.setCursorPosition(Math.max(0, currentPosition - 1));
        break;

      case "ArrowRight":
        editor.setCursorPosition(
          Math.min(editor.getRawText().length, currentPosition + 1)
        );
        break;

      case "v":
      case "V":
        if (event.ctrlKey) {
          event.preventDefault();
          try {
            const pastedText = await navigator.clipboard.readText();
            handlePasteString(pastedText);
            emitCursorPosition();
          } catch (err) {
            console.error("Clipboard access denied", err);
          }
        }
        break;

      default:
        if (key.length === 1) {
          editor.insertChar(key, currentPosition);
          editor.setCursorPosition(currentPosition + 1);
          emitTextOperation({
            type: "insert",
            position: currentPosition,
            character: key,
            userId,
          });

          emitCursorPosition();
        }
    }

    emitCursorPosition();
    event.preventDefault();
  };

  const handlePasteString = (pastedText: string) => {
    if (!editor || permission === "read") return;

    let curPos = editor.cursor_position;

    for (const char of pastedText) {
      editor.insertChar(char, curPos);
      emitTextOperation({
        type: "insert",
        position: curPos,
        character: char,
        userId,
      });
      curPos++;
    }

    editor.setCursorPosition(curPos);
    emitCursorPosition();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (permission === "read") return;

    event.preventDefault();
    const pastedText = event.clipboardData.getData("text/plain");
    handlePasteString(pastedText);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!editor || !editorRef.current) return;

    // Calculate click position relative to editor
    const rect = editorRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert coordinates to text position
    const position = editor.findPositionFromCoordinates(x, y, fontInfo);
    editor.setCursorPosition(position);

    emitCursorPosition();
  };

  const handleShare = () => {
    if (permission !== "admin") {
      alert("Only document owners can share documents");
      return;
    }

    setIsShareDialogOpen(true);
    setShareUsername("");
    setShareAccess("read");
    setShareStatus("");
  };

  const submitShare = () => {
    if (!shareUsername.trim()) {
      setShareStatus("Please enter a username");
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit("share-document", {
        documentId,
        username: shareUsername.trim(),
        access: shareAccess,
      });
      setShareStatus("Processing...");
    } else {
      setShareStatus("Error: Not connected to server");
    }
  };

  if (isLoading) {
    return (
      <div className="w-[90%] h-screen flex items-center justify-center">
        <div>Loading document...</div>
      </div>
    );
  }

  return (
    <div
      className={`w-[90%] h-screen bg-gray-200 m-5 border flex flex-col rounded-lg shadow-md relative`}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 rounded-t-lg border-b">
        <div>
          <ul className="flex gap-4 text-sm font-normal">
            <li>File</li>
            <li>Edit</li>
            <li>View</li>
            <li>Insert</li>
            <li>Format</li>
            <li>Tools</li>
            <li>Extensions</li>
            <li>Help</li>
          </ul>
        </div>
        {permission === "admin" && (
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1 border rounded-md bg-white hover:bg-gray-50"
          >
            <FaShare size={16} />
            Share
          </button>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable={permission !== "read"}
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onPaste={handlePaste}
        className={`w-full h-full min-h-64 p-5 bg-white border-gray-300 font-mono text-base focus:outline-none overflow-auto caret-transparent ${
          permission === "read" ? "cursor-default bg-gray-50" : ""
        }`}
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: `${fontInfo.height}px`,
        }}
        dangerouslySetInnerHTML={{ __html: text }}
      />
      {permission === "read" && (
        <div className="absolute bottom-4 right-4 bg-yellow-100 px-3 py-1 rounded-md text-sm">
          Read-only mode
        </div>
      )}

      {/* Custom Dialog implementation replacing shadcn Dialog */}
      {isShareDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Share Document</h3>
              <button
                onClick={() => setIsShareDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={18} />
              </button>
            </div>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <input
                  id="username"
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                  placeholder="Enter username to share with"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="permission" className="text-sm font-medium">
                  Permission
                </label>
                <select
                  value={shareAccess}
                  onChange={(e) => setShareAccess(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="read">Read (View only)</option>
                  <option value="write">Write (Can edit)</option>
                  <option value="admin">Admin (Full control)</option>
                </select>
              </div>

              {shareStatus && (
                <div
                  className={`text-sm ${
                    shareStatus.includes("Error")
                      ? "text-red-500"
                      : "text-green-500"
                  }`}
                >
                  {shareStatus}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsShareDialogOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitShare}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        .blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>
    </div>
  );
};

export default TextEditor;
