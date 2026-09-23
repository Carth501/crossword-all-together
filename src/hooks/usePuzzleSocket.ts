import { useEffect, useRef } from "react";
import { usePuzzleStore } from "@/lib/puzzleStore";

/** Connects to the puzzle room, feeding incoming messages into the Zustand store,
 * and reconnects with backoff on drop (per-day line assignment is server-side/permanent,
 * so a fresh state_sync after reconnect is all a client needs). */
export function usePuzzleSocket() {
  const applyStateSync = usePuzzleStore((s) => s.applyStateSync);
  const applyCellUpdate = usePuzzleStore((s) => s.applyCellUpdate);
  const markLineCompleted = usePuzzleStore((s) => s.markLineCompleted);
  const setSpectator = usePuzzleStore((s) => s.setSpectator);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let socket: WebSocket;

    const connect = () => {
      if (cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/puzzle`);
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "state_sync":
            applyStateSync(message);
            break;
          case "cell_update":
            applyCellUpdate(message.row, message.col, message.contributions);
            break;
          case "line_completed":
            markLineCompleted(message.line_id);
            break;
          case "room_full":
            setSpectator(true);
            break;
          default:
            break;
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        attempt += 1;
        const delay = Math.min(1000 * 2 ** attempt, 15000);
        setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      socketRef.current?.close();
    };
  }, [applyStateSync, applyCellUpdate, markLineCompleted, setSpectator]);

  const submitLetter = (lineId: number, row: number, col: number, letter: string) => {
    socketRef.current?.send(JSON.stringify({ type: "submit_letter", line_id: lineId, row, col, letter }));
  };

  const submitLine = (lineId: number) => {
    socketRef.current?.send(JSON.stringify({ type: "submit_line", line_id: lineId }));
  };

  return { submitLetter, submitLine };
}
