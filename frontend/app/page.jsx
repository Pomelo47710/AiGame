"use client";

import { useEffect, useMemo, useState } from "react";
import GameRoom from "../components/GameRoom";
import { getSocket } from "../lib/socket";

function FeatureCard({ title, text }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm uppercase tracking-[0.24em] text-sky-300/70">{title}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">{text}</p>
    </div>
  );
}

function RuleItem({ title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
    </div>
  );
}

export default function HomePage() {
  const socket = useMemo(() => getSocket(), []);
  const [mode, setMode] = useState("create");
  const [showRules, setShowRules] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [password, setPassword] = useState("");
  const [aiCount, setAiCount] = useState(1);
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [session, setSession] = useState({ roomCode: "", playerId: "" });
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    socket.connect();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleRoomCreated = ({ roomCode, playerId }) => {
      setSession({ roomCode, playerId });
      setError("");
    };
    const handleRoomJoined = ({ roomCode, playerId }) => {
      setSession({ roomCode, playerId });
      setError("");
    };
    const handleRoomState = (nextRoomState) => {
      setRoomState(nextRoomState);
    };
    const handleGameError = ({ message }) => {
      setError(message || "發生未預期錯誤。");
    };
    const handleKicked = ({ message }) => {
      setRoomState(null);
      setSession({ roomCode: "", playerId: "" });
      setError(message || "你已被房主移出房間。");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room_created", handleRoomCreated);
    socket.on("room_joined", handleRoomJoined);
    socket.on("room_state", handleRoomState);
    socket.on("game_error", handleGameError);
    socket.on("kicked_from_room", handleKicked);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room_created", handleRoomCreated);
      socket.off("room_joined", handleRoomJoined);
      socket.off("room_state", handleRoomState);
      socket.off("game_error", handleGameError);
      socket.off("kicked_from_room", handleKicked);
      socket.disconnect();
    };
  }, [socket]);

  const connectionText = useMemo(
    () => (isConnected ? "Socket 已連線，可以建立或加入房間。" : "正在嘗試連線到後端服務..."),
    [isConnected]
  );

  const createRoom = () => {
    setError("");
    socket.emit("create_room", {
      playerName,
      password,
      aiCount
    });
  };

  const joinRoom = () => {
    setError("");
    socket.emit("join_room", {
      roomCode: joinRoomCode.toUpperCase(),
      playerName,
      password
    });
  };

  const startGame = () => {
    socket.emit("start_game", {
      roomCode: session.roomCode,
      playerId: session.playerId
    });
  };

  const sendMessage = (content) => {
    socket.emit("send_message", {
      roomCode: session.roomCode,
      playerId: session.playerId,
      content
    });
  };

  const castVote = (targetId) => {
    socket.emit("cast_vote", {
      roomCode: session.roomCode,
      playerId: session.playerId,
      targetId
    });
  };

  const kickPlayer = (targetId) => {
    socket.emit("kick_player", {
      roomCode: session.roomCode,
      playerId: session.playerId,
      targetId
    });
  };

  if (roomState && session.roomCode) {
    return (
      <GameRoom
        room={roomState}
        error={error}
        isConnected={isConnected}
        onStartGame={startGame}
        onSendMessage={sendMessage}
        onCastVote={castVote}
        onKickPlayer={kickPlayer}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-4 shadow-glow backdrop-blur sm:p-6 lg:rounded-[2rem] lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr] lg:gap-8">
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-[0.32em] text-sky-300/70 sm:text-sm">
                Realtime Social Deduction
              </p>
              <button
                type="button"
                onClick={() => setShowRules((value) => !value)}
                className="inline-flex items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20"
              >
                {showRules ? "收合規則" : "查看規則"}
              </button>
            </div>

            <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-6xl">
              誰是臥底？
              <span className="block bg-gradient-to-r from-sky-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                人類 vs AI 心理戰
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              前端使用 Next.js + Tailwind CSS，後端使用 Express + Socket.io + Gemini API。
              玩家會被分配虛擬名稱與個人簡介，只能依據身份卡發言，在四輪互動與投票裡揪出隱藏的 AI。
            </p>

            {showRules ? (
              <div className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white sm:text-xl">遊戲規則</h2>
                    <p className="mt-1 text-sm text-slate-400">首次進房前可以先快速確認流程與限制。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRules(false)}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                  >
                    關閉
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <RuleItem
                    title="身份遮蔽"
                    text="開局後每位玩家都會拿到隨機編號、虛擬名稱與個人簡介，只能根據這張身份卡發言。"
                  />
                  <RuleItem
                    title="發言限制"
                    text="每輪依序輪流發言，單次最多 300 字，禁止透露真實生活資訊、聯絡方式或明示自己是 AI。"
                  />
                  <RuleItem
                    title="投票淘汰"
                    text="每輪發言結束後由所有存活玩家盲投，最高票者直接淘汰；若平票，則由平票者重新發言後加時投票。"
                  />
                  <RuleItem
                    title="勝利條件"
                    text="人類要找出並淘汰全部 AI；AI 要存活到最後，或在四輪結束後讓存活 AI 數量大於存活人類。"
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <FeatureCard title="即時同步" text="所有發言順序、投票狀態與淘汰結果都透過 WebSocket 即時更新。" />
              <FeatureCard title="身份遮蔽" text="開局後每位玩家都會獲得隨機編號、暱稱與個人簡介，降低作弊可能。" />
              <FeatureCard title="AI 演出" text="Gemini 會嚴格扮演虛擬角色，用台灣口語回話，不主動露出 AI 味。" />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 sm:rounded-[1.75rem] sm:p-5">
            <div className="flex rounded-2xl border border-white/10 bg-slate-950/60 p-1">
              <button
                type="button"
                onClick={() => setMode("create")}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:min-h-12 ${
                  mode === "create" ? "bg-sky-400 text-slate-950" : "text-slate-300"
                }`}
              >
                建立房間
              </button>
              <button
                type="button"
                onClick={() => setMode("join")}
                className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:min-h-12 ${
                  mode === "join" ? "bg-sky-400 text-slate-950" : "text-slate-300"
                }`}
              >
                加入房間
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">玩家名稱</label>
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="例如：Nick"
                  className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-sky-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">房間密碼</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="輸入房間密碼"
                  className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-sky-400"
                />
              </div>

              {mode === "create" ? (
                <div>
                  <label className="mb-2 block text-sm text-slate-300">AI 玩家數量</label>
                  <select
                    value={aiCount}
                    onChange={(event) => setAiCount(Number(event.target.value))}
                    className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-sky-400"
                  >
                    <option value={1}>1 位 AI</option>
                    <option value={2}>2 位 AI</option>
                    <option value={3}>3 位 AI</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm text-slate-300">房間代碼</label>
                  <input
                    value={joinRoomCode}
                    onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
                    placeholder="例如：AB12CD"
                    className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 uppercase text-white outline-none transition focus:border-sky-400"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!isConnected || !playerName.trim() || !password.trim() || (mode === "join" && !joinRoomCode.trim())}
              onClick={mode === "create" ? createRoom : joinRoom}
              className="mt-6 min-h-12 w-full rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {mode === "create" ? "建立房間並成為房主" : "加入現有房間"}
            </button>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
              <p>{connectionText}</p>
              <p className="mt-2 leading-7">
                後端網址來自 `NEXT_PUBLIC_SOCKET_URL`，部署到 Render 後只要換成 Web Service 網址即可。
              </p>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-50">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

