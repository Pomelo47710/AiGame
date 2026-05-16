"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function getPhaseLabel(room) {
  switch (room.phase) {
    case "lobby":
      return "等待開局";
    case "speaking":
      return "輪流發言";
    case "tie_break_speaking":
      return "平票加時發言";
    case "voting":
      return room.voteMode === "tie_break" ? "加時投票" : "盲投階段";
    case "ended":
      return "對局結束";
    default:
      return "同步中";
  }
}

function messageBubbleStyle(type, isSelf) {
  if (type === "system") {
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-50";
  }

  if (isSelf) {
    return "border-sky-400/30 bg-sky-400/10 text-sky-50";
  }

  return "border-white/10 bg-white/5 text-slate-100";
}

export default function GameRoom({
  room,
  error,
  isConnected,
  onStartGame,
  onSendMessage,
  onCastVote
}) {
  const [message, setMessage] = useState("");
  const bottomRef = useRef(null);

  const self = room?.self;
  const canSpeak =
    room?.status === "in_game" &&
    (room?.phase === "speaking" || room?.phase === "tie_break_speaking") &&
    room?.currentSpeakerId === self?.id &&
    self?.isAlive;

  const canVote =
    room?.status === "in_game" &&
    room?.phase === "voting" &&
    self?.isAlive &&
    !room?.hasViewerVoted;

  const voteTargets = useMemo(() => {
    if (!room?.players) {
      return [];
    }

    return room.players.filter((player) => {
      if (!player.isAlive || player.id === self?.id) {
        return false;
      }

      if (room.votingTargets?.length) {
        return room.votingTargets.includes(player.id);
      }

      return true;
    });
  }, [room, self?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages]);

  useEffect(() => {
    if (!canSpeak) {
      setMessage("");
    }
  }, [canSpeak]);

  const speakingHint = canSpeak
    ? "輪到你發言，送出前請確認內容沒有暴露現實資訊。"
    : self?.isAlive
      ? "現在不是你的發言時間，傳送鍵會保持反灰。"
      : "你已遭淘汰，目前為觀戰狀態。";

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-glow backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Who Is Undercover</p>
            <h1 className="mt-2 text-3xl font-bold text-white">誰是臥底？人類 vs AI 心理戰</h1>
            <p className="mt-2 text-sm text-slate-300">
              房號 <span className="font-semibold text-sky-300">{room.code}</span> ・ 狀態{" "}
              <span className="font-semibold text-white">{getPhaseLabel(room)}</span> ・ 連線{" "}
              <span className={isConnected ? "text-emerald-300" : "text-rose-300"}>
                {isConnected ? "已連線" : "已中斷"}
              </span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">當前輪次</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {room.currentRound?.title || "Lobby"}
              </p>
              <p className="mt-2 text-sm text-slate-300">{room.currentRound?.prompt || "等待房主開始遊戲"}</p>
            </div>

            <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-sky-200/70">你的身份卡</p>
              <p className="mt-2 text-lg font-semibold text-white">{self?.displayName || "尚未同步"}</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {self?.profile || "遊戲開始後，這裡會顯示你的虛擬個人簡介。"}
              </p>
            </div>
          </div>
        </div>

        {room.status === "lobby" ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
            <p>房主可在玩家到齊後開始遊戲。規則上需要 3 到 7 位人類玩家，並搭配 1 到 3 位 AI。</p>
            <p className="mt-2">若總玩家數不足 5 人，系統會自動跳過第二輪。</p>
          </div>
        ) : null}

        {room.winner ? (
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50">
            <p className="text-lg font-semibold">{room.winner.title}</p>
            <p className="mt-2">{room.winner.detail}</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-50">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
        <section className="flex min-h-[560px] flex-col rounded-3xl border border-white/10 bg-slate-950/65 p-4 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="text-xl font-semibold text-white">對話紀錄</h2>
              <p className="mt-1 text-sm text-slate-400">所有狀態同步都由 Socket.io 即時推送。</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {room.messages?.length || 0} 則訊息
            </div>
          </div>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {(room.messages || []).map((item) => {
              const isSelf = item.speakerId && item.speakerId === self?.id;
              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-4 ${messageBubbleStyle(item.type, isSelf)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      {item.type === "system" ? "系統" : item.speakerName}
                    </p>
                    <p className="text-xs text-slate-300">
                      {new Date(item.createdAt).toLocaleTimeString("zh-TW", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.content}</p>
                </article>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-300">{speakingHint}</p>
              <p className="text-xs text-slate-400">{message.length}/300</p>
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, 300))}
              disabled={!canSpeak}
              rows={4}
              placeholder={canSpeak ? "輸入你的發言..." : "等待輪到你發言"}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400 disabled:bg-slate-900 disabled:text-slate-500"
            />

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={!canSpeak || !message.trim()}
                onClick={() => {
                  onSendMessage(message.trim());
                  setMessage("");
                }}
                className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:bg-slate-700 disabled:text-slate-400"
              >
                送出發言
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">玩家列表</h2>
                <p className="mt-1 text-sm text-slate-400">顯示存活狀態、房主與目前發言者。</p>
              </div>
              {room.status === "lobby" && self?.isHost ? (
                <button
                  type="button"
                  onClick={onStartGame}
                  className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                >
                  開始遊戲
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {(room.players || []).map((player) => (
                <div
                  key={player.id}
                  className={`rounded-2xl border px-4 py-3 ${
                    player.isCurrentSpeaker
                      ? "border-sky-400/30 bg-sky-400/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{player.displayName}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {player.isHost ? "房主" : "玩家"} ・{" "}
                        {player.isAlive ? "存活" : "已淘汰"} ・{" "}
                        {player.isCurrentSpeaker ? "正在發言" : "等待中"}
                      </p>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        player.isAlive
                          ? "bg-emerald-400/15 text-emerald-200"
                          : "bg-rose-400/15 text-rose-200"
                      }`}
                    >
                      {player.isAlive ? "Alive" : "Out"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-4 backdrop-blur">
            <h2 className="text-xl font-semibold text-white">投票區</h2>
            <p className="mt-1 text-sm text-slate-400">
              只有投票階段且你仍存活時才可操作，其他時間按鈕保持反灰。
            </p>

            <div className="mt-4 space-y-3">
              {voteTargets.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  disabled={!canVote}
                  onClick={() => onCastVote(player.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-rose-300/30 hover:bg-rose-400/10 disabled:border-white/10 disabled:bg-slate-900 disabled:text-slate-500"
                >
                  <span className="font-medium text-white">{player.displayName}</span>
                  <span className="text-xs text-slate-400">
                    {room.hasViewerVoted ? "已投票" : canVote ? "投出質疑票" : "尚未開放"}
                  </span>
                </button>
              ))}
            </div>

            {!voteTargets.length ? (
              <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                目前沒有可投票的對象。
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
