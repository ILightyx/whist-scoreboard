// Games live in IndexedDB (via Dexie) and autosave on every change, so a
// refresh, a crash or going offline never loses a score sheet.

import Dexie, { type Table } from 'dexie';
import type { Game } from '../game/model';

class ScorekeeperDb extends Dexie {
  games!: Table<Game, string>;

  constructor() {
    super('scorekeeper');
    this.version(1).stores({ games: 'id, updatedAt, kind' });
  }
}

export const db = new ScorekeeperDb();

export async function saveGame(game: Game): Promise<void> {
  await db.games.put(game);
  rememberNames(game.players);
}

export async function listGames(): Promise<Game[]> {
  return db.games.orderBy('updatedAt').reverse().toArray();
}

export async function loadGame(id: string): Promise<Game | undefined> {
  return db.games.get(id);
}

export async function deleteGame(id: string): Promise<void> {
  await db.games.delete(id);
}

// Small conveniences live in localStorage; they're per device and optional.

const NAMES_KEY = 'scorekeeper.recentNames';
const SETTINGS_KEY = 'scorekeeper.settings';

export function recentNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function rememberNames(names: string[]): void {
  try {
    const merged = [...names, ...recentNames().filter((name) => !names.includes(name))].slice(0, 24);
    localStorage.setItem(NAMES_KEY, JSON.stringify(merged));
  } catch {
    // Private mode or blocked storage: names are just not remembered.
  }
}

export interface Settings {
  /** Allow writing with a finger as well as a pen (turns off palm rejection). */
  fingerWriting: boolean;
}

export function loadSettings(): Settings {
  try {
    return { fingerWriting: false, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { fingerWriting: false };
  }
}

export function storeSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore: settings fall back to defaults next time.
  }
}

const INK_STATS_KEY = 'scorekeeper.inkStats';

/** How often handwriting was accepted directly vs. corrected with a candidate chip. */
export interface InkStats {
  accepted: number;
  corrected: number;
}

export function loadInkStats(): InkStats {
  try {
    return { accepted: 0, corrected: 0, ...(JSON.parse(localStorage.getItem(INK_STATS_KEY) ?? '{}') as Partial<InkStats>) };
  } catch {
    return { accepted: 0, corrected: 0 };
  }
}

export function countInk(outcome: keyof InkStats): void {
  try {
    const stats = loadInkStats();
    stats[outcome]++;
    localStorage.setItem(INK_STATS_KEY, JSON.stringify(stats));
  } catch {
    // Stats are optional.
  }
}

/** A game as a JSON file, for sharing or backup. */
export function exportGame(game: Game): Blob {
  return new Blob([JSON.stringify({ format: 'scorekeeper-game', version: 1, game }, null, 2)], { type: 'application/json' });
}

export function parseImportedGame(text: string): Game {
  const parsed = JSON.parse(text) as { format?: string; game?: Game };
  if (parsed.format !== 'scorekeeper-game' || !parsed.game || !Array.isArray(parsed.game.players)) {
    throw new Error('This file is not a Scorekeeper game.');
  }
  return parsed.game;
}
