import { useEffect, useRef, useState } from 'react';
import { computeSheet, type Game } from '../game/model';
import { deleteGame, listGames, parseImportedGame, saveGame } from '../storage/db';
import { SettingsPanel } from './SettingsPanel';
import { useI18n } from '../i18n/context';

export function Home({ onNewGame, onOpen }: { onNewGame: () => void; onOpen: (game: Game) => void }) {
  const { t, language } = useI18n();
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
    // Everyone in first place (ties share it; the "0 points wins" rule is already in places).
    const winners = sheet.places.flatMap((place, seat) => (place === 1 ? [seat] : []));
    return (
      <li key={game.id} className="game-row">
        <button className="game-open" onClick={() => onOpen(game)}>
          <span className="game-kind">{t(game.kind === 'whist' ? 'kind.whistShort' : 'kind.rentz')}</span>
          <span className="game-players">{game.players.join(', ')}</span>
          <span className="game-progress">
            {sheet.finished
              ? t('home.winner', { name: winners.map((seat) => game.players[seat]).join(', '), total: sheet.totals[winners[0]] })
              : t('home.roundOf', { round: sheet.currentRound + 1, total: sheet.rows.length })}
          </span>
          <span className="game-date">{new Date(game.updatedAt).toLocaleString(language)}</span>
        </button>
        <button
          className="danger small"
          aria-label={t('home.deleteGame', { players: game.players.join(', ') })}
          onClick={async () => {
            if (window.confirm(t('home.deleteConfirm'))) {
              await deleteGame(game.id);
              void refresh();
            }
          }}
        >
          {t('home.delete')}
        </button>
      </li>
    );
  };

  return (
    <main className="home">
      <header className="home-header">
        <h1>Scorekeeper</h1>
        <p className="muted">{t('home.tagline')}</p>
      </header>
      <div className="home-actions">
        <button className="primary big" onClick={onNewGame}>
          {t('home.newGame')}
        </button>
        <button className="secondary" onClick={() => fileInput.current?.click()}>
          {t('home.import')}
        </button>
        <button className="secondary" onClick={() => setShowSettings(true)}>
          {t('home.settings')}
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
              setMessage(t('home.imported'));
              void refresh();
            } catch {
              setMessage(t('home.importFailed'));
            }
          }}
        />
      </div>
      {message ? <p className="notice">{message}</p> : null}
      {games === null ? null : games.length === 0 ? (
        <p className="muted empty-state">{t('home.empty', { action: t('home.newGame') })}</p>
      ) : (
        <>
          {inProgress.length ? (
            <section>
              <h2>{t('home.inProgress')}</h2>
              <ul className="game-list">{inProgress.map(row)}</ul>
            </section>
          ) : null}
          {finished.length ? (
            <section>
              <h2>{t('home.finished')}</h2>
              <ul className="game-list">{finished.map(row)}</ul>
            </section>
          ) : null}
        </>
      )}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </main>
  );
}
