"""Tracks connected clients per daily puzzle room and broadcasts state diffs."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class Room:
    # user_id -> websocket, for players with an assigned line
    players: dict[uuid.UUID, WebSocket] = field(default_factory=dict)
    # spectators: joined after the player cap was reached, read-only
    spectators: set[WebSocket] = field(default_factory=set)

    def all_sockets(self) -> list[WebSocket]:
        return [*self.players.values(), *self.spectators]


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[int, Room] = {}

    def _room(self, puzzle_id: int) -> Room:
        return self._rooms.setdefault(puzzle_id, Room())

    def connect_player(self, puzzle_id: int, user_id: uuid.UUID, websocket: WebSocket) -> None:
        self._room(puzzle_id).players[user_id] = websocket

    def connect_spectator(self, puzzle_id: int, websocket: WebSocket) -> None:
        self._room(puzzle_id).spectators.add(websocket)

    def disconnect(self, puzzle_id: int, websocket: WebSocket) -> None:
        room = self._rooms.get(puzzle_id)
        if room is None:
            return
        room.spectators.discard(websocket)
        stale = [uid for uid, ws in room.players.items() if ws is websocket]
        for uid in stale:
            del room.players[uid]

    async def broadcast(self, puzzle_id: int, message: dict) -> None:
        room = self._rooms.get(puzzle_id)
        if room is None:
            return
        for ws in room.all_sockets():
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def send_to(self, websocket: WebSocket, message: dict) -> None:
        await websocket.send_json(message)


manager = ConnectionManager()
