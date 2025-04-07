# 📝 BoobleDocs — Real-time Collaborative Text Editor

**BoobleDocs** is a real-time collaborative text editor inspired by Google Docs — built from scratch using **React**, **Socket.IO**, **Node.js**, and a custom-built editor model written in typescript. It supports multiple users editing the same document simultaneously with intelligent cursor synchronization, access control, and live updates.

> 🚀 "Built not just to work, but to wow."
---

## ✨ Features

- ⚡ **Real-time Collaboration** — Multiple users can co-edit documents with smooth, low-latency updates.
- 🧠 **Custom EditorDataModel** — Our own data model built on Linked List Data Structure to handle conflict resolution, character-by-character edits, and user cursors.
- 👥 **Live Cursor Tracking** — Each user’s cursor is uniquely colored and updated live across all clients.
- 🔐 **Permission-Based Editing** — Only invited users with proper access can edit; others can view in real time.
- 📤 **Shareable Document Links** — Easy sharing with one-click document access via links.
- 💬 **Socket.IO Driven Events** — Fast and reliable communication using WebSockets.
- 🖼️ **Responsive UI** — Beautiful, minimalistic design optimized for both desktop and mobile.
- 🎥 **Demo Walkthrough** — (Video linked below)

---

## 🧩 Tech Stack

| Layer             | Tech Used                                  |
|------------------|---------------------------------------------|
| Frontend         | React.js, Tailwind CSS                      |
| Realtime Comm.   | Socket.IO                                   |
| Backend          | Node.js, Express                            |
| Editor Engine    | Custom EditorDataModel(Linked List Approach)|
| Caching          | Redis                                       |
| Auth & Sharing   | Express-sessions                            |
| State Management | useReducer, useContext                      |

---

## 🧠 Challenges & Tricky Implementation

Implementing **boobleDocs** was not just a coding task — it was a systems challenge:

- ✍️ **Live Text Updates**: Building a custom `EditorDataModel` for managing concurrent edits without relying on third-party collaborative libraries.
- 🎯 **User Cursors**: Synchronizing multiple user cursors in real time with live updates, animations, and dynamic color assignment.
- 🔒 **Permission System**: Handling granular document permissions dynamically in a secure and scalable way.
- 🧪 **Testing Collaboration**: Ensuring consistent sync across multiple tabs, devices, and flaky networks.
- 🌐 **Socket Event Optimization**: Managing dozens of events without bottlenecks or data loss using effective debouncing and broadcasting strategies.

This was a real test of architectural design, problem-solving, and async data handling!

---

## 📸 UI Screenshots

| Dashboard View | Collaboration Live | Share Panel |
|----------------|--------------------|-------------|
|![Screenshot 2025-04-08 022030](https://github.com/user-attachments/assets/f33d8693-5102-4453-9a1f-4fe6962aba5e)|![Screenshot 2025-04-08 022151](https://github.com/user-attachments/assets/d5753e8b-a3db-4556-91e3-4453dcda0b1e)| ![Screenshot 2025-04-08 030454](https://github.com/user-attachments/assets/31d7c5ff-7e9a-4ee8-bc11-988172fd1d3d)


---

## 🎥 Demo Video

https://github.com/user-attachments/assets/bf3a861f-125d-4d94-a99c-9e60c6b838a7
