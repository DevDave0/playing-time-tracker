import React, { useState, useEffect, useRef } from "react";
import "./App.css";

interface Player {
  id: number;
  name: string;
  elapsedSeconds: number;
  prevHalfElapsed: number;
}

interface GameState {
  starters: Player[];
  bench: Player[];
}

interface HalfRecord {
  half: 1 | 2;
  players: { id: number; name: string; seconds: number }[];
}

const HALF_DURATION = 20 * 60;
const QUOTA_SECONDS = 7.5 * 60;

const createInitialState = (): GameState => ({
  starters: Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    elapsedSeconds: 0,
    prevHalfElapsed: 0,
  })),
  bench: Array.from({ length: 5 }, (_, i) => ({
    id: i + 6,
    name: `Player ${i + 6}`,
    elapsedSeconds: 0,
    prevHalfElapsed: 0,
  })),
});

const formatTime = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

type Section = "starters" | "bench";

export default function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameSeconds, setGameSeconds] = useState(0);
  const [dragOver, setDragOver] = useState<{
    section: Section;
    index: number;
  } | null>(null);
  const [dragSource, setDragSource] = useState<{
    section: Section;
    index: number;
  } | null>(null);
  const [halfHistory, setHalfHistory] = useState<HalfRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const dragInfo = useRef<{ section: Section; index: number } | null>(null);
  const prevHalfRef = useRef(1);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    if (!gameRunning) return;
    const interval = setInterval(() => {
      setGameSeconds((prev) => Math.min(prev + 1, HALF_DURATION * 2));
      setGameState((prev) => ({
        ...prev,
        starters: prev.starters.map((p) => ({
          ...p,
          elapsedSeconds: p.elapsedSeconds + 1,
        })),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameRunning]);

  useEffect(() => {
    if (gameSeconds !== HALF_DURATION && gameSeconds !== HALF_DURATION * 2)
      return;
    setGameRunning(false);
    const halfNum: 1 | 2 = gameSeconds === HALF_DURATION ? 1 : 2;
    const { starters, bench } = gameStateRef.current;
    const allPlayers = [...starters, ...bench];
    setHalfHistory((prev) => {
      if (prev.some((r) => r.half === halfNum)) return prev;
      return [
        ...prev,
        {
          half: halfNum,
          players: allPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            seconds: p.elapsedSeconds - p.prevHalfElapsed,
          })),
        },
      ];
    });
    setHistoryOpen(true);
  }, [gameSeconds]);

  const half = gameSeconds >= HALF_DURATION ? 2 : 1;

  useEffect(() => {
    if (half !== prevHalfRef.current) {
      prevHalfRef.current = half;
      setGameState((prev) => ({
        starters: prev.starters.map((p) => ({
          ...p,
          prevHalfElapsed: p.elapsedSeconds,
        })),
        bench: prev.bench.map((p) => ({
          ...p,
          prevHalfElapsed: p.elapsedSeconds,
        })),
      }));
    }
  }, [half]);
  const halfSeconds =
    gameSeconds >= HALF_DURATION ? gameSeconds - HALF_DURATION : gameSeconds;

  const updateName = (section: Section, index: number, name: string) => {
    setGameState((prev) => {
      const arr = [...(section === "starters" ? prev.starters : prev.bench)];
      arr[index] = { ...arr[index], name };
      return section === "starters"
        ? { ...prev, starters: arr }
        : { ...prev, bench: arr };
    });
  };

  const onDragStart = (section: Section, index: number) => {
    if (gameRunning) return;
    dragInfo.current = { section, index };
    setDragSource({ section, index });
  };

  const onDragOver = (e: React.DragEvent, section: Section, index: number) => {
    if (gameRunning) return;
    e.preventDefault();
    setDragOver({ section, index });
  };

  const onDrop = (
    e: React.DragEvent,
    targetSection: Section,
    targetIndex: number,
  ) => {
    e.preventDefault();
    setDragOver(null);
    setDragSource(null);
    const src = dragInfo.current;
    if (!src || gameRunning) return;
    dragInfo.current = null;
    if (src.section === targetSection && src.index === targetIndex) return;

    setGameState((prev) => {
      const s = [...prev.starters];
      const b = [...prev.bench];
      if (src.section === "starters" && targetSection === "starters") {
        [s[src.index], s[targetIndex]] = [s[targetIndex], s[src.index]];
      } else if (src.section === "bench" && targetSection === "bench") {
        [b[src.index], b[targetIndex]] = [b[targetIndex], b[src.index]];
      } else if (src.section === "bench" && targetSection === "starters") {
        [s[targetIndex], b[src.index]] = [b[src.index], s[targetIndex]];
      } else {
        [b[targetIndex], s[src.index]] = [s[src.index], b[targetIndex]];
      }
      return { starters: s, bench: b };
    });
  };

  const onDragEnd = () => {
    dragInfo.current = null;
    setDragOver(null);
    setDragSource(null);
  };

  const reset = () => {
    setGameRunning(false);
    setGameSeconds(0);
    setGameState(createInitialState());
    setHalfHistory([]);
    setHistoryOpen(false);
    prevHalfRef.current = 1;
  };

  const renderHistoryTable = () => {
    const h1 = halfHistory[0];
    const h2 = halfHistory[1] ?? null;
    const rows = [...h1.players].sort((a, b) => {
      const aTotal =
        a.seconds + (h2?.players.find((p) => p.id === a.id)?.seconds ?? 0);
      const bTotal =
        b.seconds + (h2?.players.find((p) => p.id === b.id)?.seconds ?? 0);
      return bTotal - aTotal;
    });
    return (
      <table className="history-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Half 1</th>
            {h2 && <th>Half 2</th>}
            {h2 && <th>Total</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p1) => {
            const p2 = h2?.players.find((p) => p.id === p1.id);
            const name = p2?.name ?? p1.name;
            const total = p1.seconds + (p2?.seconds ?? 0);
            const h1Met = p1.seconds >= QUOTA_SECONDS;
            const h2Met = p2 ? p2.seconds >= QUOTA_SECONDS : false;
            const totalMet = h2 ? total >= QUOTA_SECONDS * 2 : false;
            return (
              <tr key={p1.id}>
                <td>{name}</td>
                <td className={h1Met ? "cell-quota-met" : ""}>
                  {formatTime(p1.seconds)}
                </td>
                {p2 && (
                  <td className={h2Met ? "cell-quota-met" : ""}>
                    {formatTime(p2.seconds)}
                  </td>
                )}
                {h2 && (
                  <td className={totalMet ? "cell-quota-met" : ""}>
                    {formatTime(total)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderPlayer = (player: Player, section: Section, index: number) => {
    const isOnCourt = section === "starters";
    const isDragTarget =
      dragOver?.section === section && dragOver?.index === index;
    const isDragging =
      dragSource?.section === section && dragSource?.index === index;

    const thisHalfElapsed = player.elapsedSeconds - player.prevHalfElapsed;
    const quotaMet = thisHalfElapsed >= QUOTA_SECONDS;
    const fillPct = Math.min((thisHalfElapsed / QUOTA_SECONDS) * 100, 100);

    return (
      <div
        key={player.id}
        className={[
          "player-card",
          isOnCourt ? "on-court" : "on-bench",
          isDragTarget ? "drag-over" : "",
          isDragging ? "dragging" : "",
          quotaMet ? "quota-met" : "",
          gameRunning ? "drag-locked" : "",
        ].join(" ")}
        draggable={!gameRunning}
        onDragStart={() => onDragStart(section, index)}
        onDragOver={(e) => onDragOver(e, section, index)}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => onDrop(e, section, index)}
        onDragEnd={onDragEnd}
      >
        <div className="quota-fill" style={{ width: `${fillPct}%` }} />
        <span className="slot-badge">{isOnCourt ? index + 1 : index + 6}</span>
        <input
          draggable={false}
          className={`player-name-input${quotaMet ? " quota-met-name" : ""}`}
          value={player.name}
          onChange={(e) => updateName(section, index, e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Player name"
        />
        <span
          className={`player-timer${isOnCourt && gameRunning ? " active" : ""}`}
        >
          {formatTime(player.elapsedSeconds)}
        </span>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="header">
        <div className="title-group">
          <span className="ball-icon">🏀</span>
          <h1>Playing Time Tracker</h1>
        </div>

        <div className="game-clock">
          <div className="half-label">Half {half}</div>
          <div className="clock-display">{formatTime(halfSeconds)}</div>
          <div className="clock-sub">Total: {formatTime(gameSeconds)}</div>
        </div>

        <div className="header-controls">
          <button
            className={`btn-toggle ${gameRunning ? "stop" : "start"}`}
            onClick={() => setGameRunning((r) => !r)}
          >
            {gameRunning ? "Stop" : "Start"}
          </button>
          {halfHistory.length === 2 && (
            <button className="btn-reset" onClick={reset}>
              Reset
            </button>
          )}
        </div>
      </header>

      <main className="court">
        <section className="player-section">
          <div className="section-title on-court-title">
            <span className="status-dot green" />
            On Court
          </div>
          <div className="player-list">
            {gameState.starters.map((p, i) => renderPlayer(p, "starters", i))}
          </div>
        </section>

        <div className="section-divider">
          <span>Bench</span>
        </div>

        <section className="player-section">
          <div className="section-title bench-title">
            <span className="status-dot grey" />
            Bench
          </div>
          <div className="player-list">
            {gameState.bench.map((p, i) => renderPlayer(p, "bench", i))}
          </div>
        </section>
      </main>

      {halfHistory.length > 0 && (
        <div className="history-section">
          <button
            className="history-toggle"
            onClick={() => setHistoryOpen((o) => !o)}
          >
            <span>History</span>
            <span className={`history-chevron${historyOpen ? " open" : ""}`}>
              ▾
            </span>
          </button>
          {historyOpen && (
            <div className="history-content">{renderHistoryTable()}</div>
          )}
        </div>
      )}

      {halfHistory.length < 2 && (
        <div className="bottom-controls">
          <button className="btn-reset" onClick={reset}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
