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
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

type Section = "starters" | "bench";

const PencilIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

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
  const [selectedCard, setSelectedCard] = useState<{
    section: Section;
    index: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const dragInfo = useRef<{ section: Section; index: number } | null>(null);
  const prevHalfRef = useRef(1);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const touchDragActive = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const touchSourceEl = useRef<HTMLElement | null>(null);
  const ghostEl = useRef<HTMLElement | null>(null);
  const touchOffset = useRef({ x: 0, y: 0 });
  const justDragged = useRef(false);
  const performSwapRef = useRef<
    (s: Section, si: number, t: Section, ti: number) => void
  >(() => {});
  const setDragSourceRef = useRef(setDragSource);
  setDragSourceRef.current = setDragSource;

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

  // Update by id so edits survive mid-game swaps
  const updateName = (id: number, name: string) => {
    setGameState((prev) => ({
      starters: prev.starters.map((p) => (p.id === id ? { ...p, name } : p)),
      bench: prev.bench.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  };

  const startEdit = (player: Player) => {
    setEditingId(player.id);
    setEditingName(player.name);
    setSelectedCard(null);
  };

  const saveEdit = () => {
    if (editingId !== null) {
      updateName(editingId, editingName);
      setEditingId(null);
    }
  };

  const onDragStart = (section: Section, index: number) => {
    dragInfo.current = { section, index };
    setDragSource({ section, index });
  };

  const onDragOver = (e: React.DragEvent, section: Section, index: number) => {
    e.preventDefault();
    setDragOver({ section, index });
  };

  const performSwap = (
    srcSection: Section,
    srcIndex: number,
    targetSection: Section,
    targetIndex: number,
  ) => {
    if (srcSection === targetSection && srcIndex === targetIndex) return;
    setGameState((prev) => {
      const s = [...prev.starters];
      const b = [...prev.bench];
      if (srcSection === "starters" && targetSection === "starters") {
        [s[srcIndex], s[targetIndex]] = [s[targetIndex], s[srcIndex]];
      } else if (srcSection === "bench" && targetSection === "bench") {
        [b[srcIndex], b[targetIndex]] = [b[targetIndex], b[srcIndex]];
      } else if (srcSection === "bench" && targetSection === "starters") {
        [s[targetIndex], b[srcIndex]] = [b[srcIndex], s[targetIndex]];
      } else {
        [b[targetIndex], s[srcIndex]] = [s[srcIndex], b[targetIndex]];
      }
      return { starters: s, bench: b };
    });
  };
  performSwapRef.current = performSwap;

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragInfo.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      if (!touchDragActive.current && Math.sqrt(dx * dx + dy * dy) < 8) return;

      if (!touchDragActive.current) {
        touchDragActive.current = true;
        const src = touchSourceEl.current;
        if (src) {
          // Fade out the original slot
          src.style.opacity = "0.3";
          // Clone it into a floating ghost that follows the finger
          const rect = src.getBoundingClientRect();
          const ghost = src.cloneNode(true) as HTMLElement;
          ghost.removeAttribute("data-section");
          ghost.removeAttribute("data-index");
          ghost.style.cssText = [
            "position:fixed",
            `left:${touch.clientX - touchOffset.current.x}px`,
            `top:${touch.clientY - touchOffset.current.y}px`,
            `width:${rect.width}px`,
            `height:${rect.height}px`,
            "z-index:9999",
            "pointer-events:none",
            "transform:scale(1.06)",
            "box-shadow:0 16px 48px rgba(0,0,0,0.55),0 4px 16px rgba(0,0,0,0.35)",
            "opacity:0.96",
            "margin:0",
            "transition:transform 0.12s ease,box-shadow 0.12s ease",
          ].join(";");
          document.body.appendChild(ghost);
          ghostEl.current = ghost;
        }
      }

      e.preventDefault();

      // Slide ghost under finger
      if (ghostEl.current) {
        ghostEl.current.style.left = `${touch.clientX - touchOffset.current.x}px`;
        ghostEl.current.style.top = `${touch.clientY - touchOffset.current.y}px`;
      }

      const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
      const card = elements.find(
        (el) => (el as HTMLElement).dataset?.section,
      ) as HTMLElement | undefined;
      if (card) {
        setDragOver({
          section: card.dataset.section as Section,
          index: parseInt(card.dataset.index!),
        });
      } else {
        setDragOver(null);
      }
    };

    const cleanup = () => {
      if (touchSourceEl.current) {
        touchSourceEl.current.style.opacity = "";
        touchSourceEl.current = null;
      }
      if (ghostEl.current) {
        ghostEl.current.remove();
        ghostEl.current = null;
      }
      touchDragActive.current = false;
      dragInfo.current = null;
      setDragOver(null);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!dragInfo.current) return;
      if (touchDragActive.current) {
        justDragged.current = true;
        setTimeout(() => {
          justDragged.current = false;
        }, 300);
        const touch = e.changedTouches[0];
        const elements = document.elementsFromPoint(
          touch.clientX,
          touch.clientY,
        );
        const card = elements.find(
          (el) => (el as HTMLElement).dataset?.section,
        ) as HTMLElement | undefined;
        if (card && dragInfo.current) {
          performSwapRef.current(
            dragInfo.current.section,
            dragInfo.current.index,
            card.dataset.section as Section,
            parseInt(card.dataset.index!),
          );
        }
      }
      cleanup();
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", cleanup);
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", cleanup);
    };
  }, []);

  const onDrop = (
    e: React.DragEvent,
    targetSection: Section,
    targetIndex: number,
  ) => {
    e.preventDefault();
    setDragOver(null);
    setDragSource(null);
    const src = dragInfo.current;
    if (!src) return;
    dragInfo.current = null;
    performSwap(src.section, src.index, targetSection, targetIndex);
  };

  const handleCardClick = (section: Section, index: number) => {
    if (justDragged.current) return;
    if (!selectedCard) {
      setSelectedCard({ section, index });
      return;
    }
    if (selectedCard.section === section && selectedCard.index === index) {
      setSelectedCard(null);
      return;
    }
    performSwap(selectedCard.section, selectedCard.index, section, index);
    setSelectedCard(null);
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
    setEditingId(null);
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
    const isSelected =
      selectedCard?.section === section && selectedCard?.index === index;
    const isEditing = editingId === player.id;

    const thisHalfElapsed = player.elapsedSeconds - player.prevHalfElapsed;
    const quotaMet = thisHalfElapsed >= QUOTA_SECONDS;
    const fillPct = Math.min((thisHalfElapsed / QUOTA_SECONDS) * 100, 100);

    const h1Secs =
      halfHistory[0]?.players.find((p) => p.id === player.id)?.seconds ?? null;
    const h2Secs =
      halfHistory[1]?.players.find((p) => p.id === player.id)?.seconds ?? null;

    return (
      <div
        key={player.id}
        data-section={section}
        data-index={index}
        className={[
          "player-card",
          isOnCourt ? "on-court" : "on-bench",
          isDragTarget ? "drag-over" : "",
          isDragging ? "dragging" : "",
          quotaMet ? "quota-met" : "",
          isSelected ? "selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        draggable={!isEditing}
        onClick={() => !isEditing && handleCardClick(section, index)}
        onTouchStart={(e) => {
          if (isEditing) return;
          const el = e.currentTarget as HTMLElement;
          const rect = el.getBoundingClientRect();
          touchSourceEl.current = el;
          touchStartPos.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
          touchOffset.current = {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
          };
          dragInfo.current = { section, index };
        }}
        onDragStart={() => onDragStart(section, index)}
        onDragOver={(e) => onDragOver(e, section, index)}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => onDrop(e, section, index)}
        onDragEnd={onDragEnd}
      >
        <div className="quota-fill" style={{ width: `${fillPct}%` }} />
        <span className="slot-badge">{isOnCourt ? index + 1 : index + 6}</span>

        {isEditing ? (
          <>
            <input
              autoFocus
              className={`player-name-input${quotaMet ? " quota-met-name" : ""}`}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            />
            <button
              className="name-action-btn save-btn"
              onClick={(e) => {
                e.stopPropagation();
                saveEdit();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <CheckIcon />
            </button>
          </>
        ) : (
          <>
            <span
              className={`player-name-display${quotaMet ? " quota-met-name" : ""}`}
            >
              {player.name}
            </span>
            <button
              className="name-action-btn edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                startEdit(player);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <PencilIcon />
            </button>
          </>
        )}

        <div className="player-times">
          {h1Secs !== null && (
            <>
              <span className="time-half">{formatTime(h1Secs)}</span>
              <span className="time-sep">·</span>
            </>
          )}
          {h2Secs !== null ? (
            <>
              <span className="time-half">{formatTime(h2Secs)}</span>
              <span className="time-sep">·</span>
              <span className="player-timer time-total">
                {formatTime(h1Secs! + h2Secs)}
              </span>
            </>
          ) : (
            <span
              className={`player-timer${isOnCourt && gameRunning ? " active" : ""}`}
            >
              {formatTime(thisHalfElapsed)}
            </span>
          )}
        </div>
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
            {gameRunning ? "Pause" : "Start"}
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
