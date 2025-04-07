import { useEffect, useState } from "react";
import DashHeader from "../components/DashHeader";
import DotOptions from "../components/DotOptions";
import { useNavigate } from "react-router-dom";

type Cursor = {
  userId: string;
  username: string;
  position: number;
  color: string;
};

type Document = {
  id: string;
  title: string;
  cursors: Cursor[];
  content: string;
  createdBy: string;
  updatedAt: string;
  access: string;
};

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("http://localhost:3000/doc/", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch documents: ${response.status}`);
        }

        const data = await response.json();

        const parsedDocuments: Document[] = Object.entries(data).map(
          ([id, doc]) => ({
            id,
            ...(doc as Omit<Document, "id">),
          })
        );

        setDocuments(parsedDocuments);
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [refresh]);

  const handleCreateDocument = async () => {
    try {
      const response = await fetch(`http://localhost:3000/doc/new/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `Untitled Document` }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create document: ${response.status}`);
      }

      const responseObj = await response.json();

      navigate(`/app/document/${responseObj.docId}`);
    } catch (error) {
      console.error("Error creating document:", error);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center overflow-x-hidden">
      <div className="w-full flex flex-col mt-10 px-[250px]">
        <div>
          <h2 className="text-lg font-light">Start a new document</h2>

          <div
            className="w-[150px] h-[200px] bg-white shadow-xl border border-gray-300 my-5 flex flex-col justify-center items-center cursor-pointer"
            onClick={handleCreateDocument}
          >
            <span className="text-5xl">+</span>
          </div>
        </div>
      </div>

      <div className="w-full px-[250px]">
        <h2 className="text-lg my-5 font-light">Recent Documents</h2>

        {isLoading ? (
          <p>Loading...</p>
        ) : documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="p-3 border rounded-md cursor-pointer flex justify-between items-center hover:bg-gray-100"
              >
                <div onClick={() => navigate(`/app/document/${doc.id}`)}>
                  <h3 className="font-medium">{doc.title}</h3>
                  <p className="text-sm text-gray-600">
                    Last edited: {new Date(doc.updatedAt).toLocaleString()}
                  </p>
                  <p className="text-sm">Access: {doc.access}</p>
                </div>

                <DotOptions doc={doc} setRefresh={setRefresh}/>
              </li>
            ))}
          </ul>
        ) : (
          <p>No documents found.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
