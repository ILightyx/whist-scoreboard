import { useEffect, useRef, useState } from 'react';
import { computeSheet, type Game } from '../game/model';
import { deleteGame, listGames, parseImportedGame, saveGame } from '../storage/db';
import { SettingsPanel } from './SettingsPanel';

export function Home({ onNewGame, onOpen }: { onNewGame: () => void; onOpen: (game: Game) => void }) {
  const [games, setGames] = useState<Game[] | null>(null);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => listGames().then(setGames);
  useEffect(() => {
    void refresh();
  }, []);

  const inProgress = games?.filter((game) => !computeSheet(game).finished) ?? [];
  const finished = games?.filter((game) => computeSheet(game).finished) ?? [];

  const row = (game: Game) => {
    const sheet = computeSheet(game);
    const leader = sheet.totals.length ? sheet.totals.indexOf(Math.max(...sheet.totals)) : 0;
    return (
      <li key={game.id} className="game-row">
        <button className="game-open" onClick={() => onOpen(game)}>
          <span className="game-kind">{game.kind === 'whist' ? 'Whist' : 'Rentz'}</span>
          <span className="game-players">{game.players.join(', ')}</span>
          <span className="game-progress">
            {sheet.finished
              ? `Winner: ${game.players[leader]} (${sheet.totals[leader]})`
              : `Round ${sheet.currentRound + 1} of ${sheet.rows.length}`}
          </span>
          <span className="game-date">{new Date(game.updatedAt).toLocaleString()}</span>
        </button>
        <button
          className="danger small"
          aria-label={`Delete game of ${game.players.join(', ')}`}
          onClick={async () => {
            if (window.confirm('Delete this game?')) {
              await deleteGame(game.id);
              void refresh();
            }
          }}
        >
          Delete
        </button>
      </li>
    );
  };

  return (
    <main className="home">
      <header className="home-header">
        <h1>Scorekeeper</h1>
        <p className="muted">Romanian Whist and Rentz, scored for you. Works offline.</p>
      </header>
      <div className="home-actions">
        <button className="primary big" onClick={onNewGame}>
          New game
        </button>
        <button className="secondary" onClick={() => fileInput.current?.click()}>
          Import game
        </button>
        <button className="secondary" onClick={() => setShowSettings(true)}>
          Settings
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              await saveGame(parseImportedGame(await file.text()));
              setMessage('Game imported.');
              void refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Could not import that file.');
            }
          }}
        />
      </div>
      {message ? <p className="notice">{message}</p> : null}
      {games === null ? null : games.length === 0 ? (
        <p className="muted empty-state">No games yet. Start one with “New game”.</p>
      ) : (
        <>
          {inProgress.length ? (
            <section>
              <h2>In progress</h2>
              <ul className="game-list">{inProgress.map(row)}</ul>
            </section>
          ) : null}
          {finished.length ? (
            <section>
              <h2>Finished</h2>
              <ul className="game-list">{finished.map(row)}</ul>
            </section>
          ) : null}
        </>
      )}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </main>
  );
}
