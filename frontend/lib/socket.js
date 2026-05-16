"use client";

import { io } from "socket.io-client";

let socketInstance = null;

export function getSocket() {
  if (socketInstance) {
    return socketInstance;
  }

  const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
  socketInstance = io(serverUrl, {
    autoConnect: false,
    transports: ["websocket"]
  });

  return socketInstance;
}
