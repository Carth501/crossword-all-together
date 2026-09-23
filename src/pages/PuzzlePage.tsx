import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { usePuzzleStore } from "@/lib/puzzleStore";
import { usePuzzleSocket } from "@/hooks/usePuzzleSocket";
import { PuzzleGrid } from "@/components/PuzzleGrid";
import { Button } from "@/components/ui/button";

export function PuzzlePage() {
  const { user, logout } = useAuth();
  const isSpectator = usePuzzleStore((s) => s.isSpectator);
  usePuzzleSocket();

  useEffect(() => {
    document.title = "Cooperative Crossword";
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cooperative Crossword</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user?.display_name}</p>
        </div>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </header>

      {isSpectator && (
        <p className="mb-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Today's puzzle is full — you're spectating in read-only mode.
        </p>
      )}

      <PuzzleGrid />
    </div>
  );
}
