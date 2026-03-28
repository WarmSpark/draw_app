"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const HTTP_BACKEND =
  process.env.NEXT_PUBLIC_HTTP_BACKEND || "http://localhost:3001";
const WS_BACKEND =
  process.env.NEXT_PUBLIC_WS_BACKEND || "ws://localhost:8080";

interface Room {
  id: number;
  Slug: string;
  CreatedAt: string;
  admin: { name: string };
}

interface Message {
  id?: number;
  message: string;
  userId: string;
  user?: { name: string; id: string };
}

function decodeToken(token: string): { userId: string } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sidebar state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Chat state
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch rooms
  const fetchRooms = useCallback(
    async (token: string) => {
      try {
        const res = await fetch(`${HTTP_BACKEND}/rooms`, {
          headers: { Authorization: token },
        });
        if (res.status === 403) {
          localStorage.removeItem("token");
          router.push("/signin");
          return;
        }
        const data = await res.json();
        setRooms(data.rooms || []);
      } catch {
        /* ignore */
      } finally {
        setLoadingRooms(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }
    const decoded = decodeToken(token);
    if (!decoded) {
      router.push("/signin");
      return;
    }
    currentUserId.current = decoded.userId;
    fetchRooms(token);
  }, [router, fetchRooms]);

  // Select room → load messages + connect WS
  const selectRoom = useCallback(
    (room: Room) => {
      // Disconnect previous WS
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN && activeRoom) {
          wsRef.current.send(
            JSON.stringify({ type: "leave_room", roomId: String(activeRoom.id) })
          );
        }
        wsRef.current.close();
        wsRef.current = null;
      }

      setActiveRoom(room);
      setMessages([]);
      setConnected(false);
      setSidebarOpen(false);

      const token = localStorage.getItem("token");
      if (!token) return;

      // Load existing messages
      fetch(`${HTTP_BACKEND}/chats/${room.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.messages) setMessages(data.messages.reverse());
        });

      // Connect WebSocket
      const ws = new WebSocket(
        `${WS_BACKEND}?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "join_room", roomId: String(room.id) }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "chat" && String(data.roomId) === String(room.id)) {
            setMessages((prev) => [
              ...prev,
              { message: data.message, userId: data.userId || "" },
            ]);
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => setConnected(false);

      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [activeRoom]
  );

  // Auto-select room from ?room= query param
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current || rooms.length === 0) return;
    const roomParam = searchParams.get("room");
    if (roomParam) {
      const found = rooms.find((r) => r.id === Number(roomParam));
      if (found) {
        autoSelectedRef.current = true;
        selectRoom(found);
      }
    }
  }, [rooms, searchParams, selectRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Create room
  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;
    setCreateError("");
    try {
      const res = await fetch(`${HTTP_BACKEND}/room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ name: roomName }),
      });
      const data = await res.json();
      if (data.roomId) {
        setRoomName("");
        setShowCreate(false);
        fetchRooms(token);
      } else {
        setCreateError(data.message || "Failed to create room");
      }
    } catch {
      setCreateError("Something went wrong");
    }
  };

  // Send message
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !input.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      !activeRoom
    )
      return;
    wsRef.current.send(
      JSON.stringify({
        type: "chat",
        roomId: String(activeRoom.id),
        message: input.trim(),
      })
    );
    setInput("");
  };

  const logout = () => {
    if (wsRef.current) wsRef.current.close();
    localStorage.removeItem("token");
    router.push("/signin");
  };

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            Chat<span>Room</span>
          </div>
          <div className="sidebar-actions">
            <button
              className="sidebar-icon-btn"
              onClick={() => setShowCreate(!showCreate)}
              title="New room"
            >
              +
            </button>
            <button
              className="sidebar-icon-btn"
              onClick={logout}
              title="Logout"
            >
              ⏻
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="sidebar-create">
            <form className="sidebar-create-form" onSubmit={createRoom}>
              <input
                className="form-input"
                placeholder="Room name..."
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                minLength={3}
                maxLength={20}
                autoFocus
              />
              <button className="btn btn-primary" type="submit">
                Create
              </button>
            </form>
            {createError && (
              <div className="sidebar-create-error">{createError}</div>
            )}
          </div>
        )}

        <div className="sidebar-rooms">
          {loadingRooms ? (
            <div className="loading-state">Loading...</div>
          ) : rooms.length === 0 ? (
            <div className="sidebar-empty">
              <span className="sidebar-empty-icon">💬</span>
              <h4>No rooms yet</h4>
              <p>Create your first room to start chatting</p>
            </div>
          ) : (
            rooms.map((room, i) => (
              <div
                key={room.id}
                className={`room-item ${activeRoom?.id === room.id ? "active" : ""}`}
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => selectRoom(room)}
              >
                <div className="room-item-avatar">💬</div>
                <div className="room-item-info">
                  <div className="room-item-name">{room.Slug}</div>
                  <div className="room-item-meta">
                    by {room.admin.name}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="chat-main">
        <div className="chat-main-bg" />

        {/* Mobile header (hamburger) */}
        <div className="mobile-header">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="sidebar-brand">
            Chat<span>Room</span>
          </div>
        </div>

        {activeRoom ? (
          <>
            {/* Chat header */}
            <div className="chat-header">
              <div className="chat-header-avatar">💬</div>
              <div className="chat-header-info">
                <h2>{activeRoom.Slug}</h2>
                <span className="room-id">Room #{activeRoom.id}</span>
              </div>
              <div
                className={`connection-status ${connected ? "connected" : ""}`}
              >
                {connected ? "Connected" : "Connecting..."}
              </div>
            </div>

            {/* Messages */}
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon">✨</div>
                <h3>No messages yet</h3>
                <p>Be the first to say something!</p>
              </div>
            ) : (
              <div className="chat-messages">
                {messages.map((msg, i) => {
                  const isSelf = msg.userId === currentUserId.current;
                  const senderName = msg.user?.name;
                  return (
                    <div
                      key={msg.id || `msg-${i}`}
                      className={`message ${isSelf ? "message-self" : "message-other"}`}
                    >
                      {!isSelf && senderName && (
                        <span className="message-sender">{senderName}</span>
                      )}
                      <div className="message-bubble">{msg.message}</div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <form className="chat-input-area" onSubmit={sendMessage}>
              <input
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button
                className="btn btn-primary chat-send"
                type="submit"
                disabled={!connected}
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">💬</div>
            <h2>Welcome to ChatRoom</h2>
            <p>Select a room from the sidebar to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
