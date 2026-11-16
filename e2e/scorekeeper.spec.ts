import { expect, type Page, test } from '@playwright/test';
import {
  computeSheet,
  createRentzGame,
  createWhistGame,
  type Game,
  type RentzGame,
  setContract,
  setValue,
} from '../src/game/model';
import { bannedBet, bettingOrder, whistRoundPlan } from '../src/rules/whist';
import { en } from '../src/i18n/en';
import { rentzContractFields, rentzDiamondsInDeck } from '../src/rules/rentz';

const PLAYERS = ['Ana', 'Bogdan', 'Cristi', 'Dana'];

/** Small deterministic random generator, so every run plays the same game. */
function rng(seed: number) {
  let state = seed;
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % (max + 1);
  };
}

function split(total: number, parts: number, random: (max: number) => number): number[] {
  const values = Array<number>(parts).fill(0);
  for (let i = 0; i < total; i++) values[random(parts - 1)]++;
  return values;
}

async function newGame(page: Page, kind: 'Romanian Whist' | 'Rentz') {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('radio', { name: kind }).click();
  for (const [index, name] of PLAYERS.entries()) {
    await page.getByLabel(`Player ${index + 1} name`).fill(name);
  }
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.sheet')).toBeVisible();
}

/** Tap a cell (opens the number pad) and type the value. */
async function enter(page: Page, label: string, value: number) {
  // Wait for the pad itself: entering a game's last value opens Standings.
  const pad = page.locator('.number-pad');
  await page.locator(`[data-ink="${label}"]`).click();
  await expect(pad).toBeVisible();
  await page.keyboard.press(String(value));
  await expect(pad).toBeHidden();
}

/** Draw strokes with a synthetic pen, the way a stylus sends Pointer Events. */
async function penWrite(page: Page, label: string, strokes: [number, number][][]) {
  await page.locator(`[data-ink="${label}"]`).evaluate((canvas, paths) => {
    const rect = canvas.getBoundingClientRect();
    let id = 40;
    for (const path of paths) {
      id++;
      const send = (type: string, [x, y]: [number, number]) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: id,
            pointerType: 'pen',
            pressure: type === 'pointerup' ? 0 : 0.6,
            clientX: rect.left + x * rect.width,
            clientY: rect.top + y * rect.height,
            isPrimary: true,
          }),
        );
      send('pointerdown', path[0]);
      for (const point of path.slice(1)) send('pointermove', point);
      send('pointerup', path[path.length - 1]);
    }
  }, strokes);
}

function line(from: [number, number], to: [number, number], steps = 24): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => [from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps]);
}

function oval(): [number, number][] {
  return Array.from({ length: 60 }, (_, i) => {
    const a = (i / 59) * Math.PI * 2 - Math.PI / 2;
    return [0.5 + 0.28 * Math.cos(a), 0.5 + 0.38 * Math.sin(a)];
  });
}

async function totalsOnScreen(page: Page): Promise<number[]> {
  return Promise.all(PLAYERS.map(async (name) => Number(await page.locator(`[data-total="${name}"]`).textContent())));
}

test('handwriting fills a cell, scratch-out clears it, and the palm is ignored', async ({ page }) => {
  await newGame(page, 'Romanian Whist');
  const cell = page.locator('[data-cell="Ana Bet round 1"] .cell-value');
  await penWrite(page, 'Ana Bet round 1', [line([0.52, 0.15], [0.5, 0.85])]);
  await expect(cell).toHaveText('1');
  // Scratch it out like on paper.
  const zigzag: [number, number][] = [[0.1, 0.4], [0.9, 0.45], [0.1, 0.5], [0.9, 0.55], [0.1, 0.6], [0.9, 0.65]];
  await penWrite(page, 'Ana Bet round 1', [zigzag.slice(1).flatMap((point, i) => line(zigzag[i], point, 8))]);
  await expect(cell).toHaveText('');
  await penWrite(page, 'Bogdan Bet round 1', [oval()]);
  await expect(page.locator('[data-cell="Bogdan Bet round 1"] .cell-value')).toHaveText('0');
  // A hand resting on the screen right after writing does not open anything.
  await page.locator('[data-ink="Cristi Bet round 1"]').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 99 });
  await page.locator('[data-ink="Cristi Bet round 1"]').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 99 });
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the last bettor cannot make the banned bet, and tricks must add up', async ({ page }) => {
  await newGame(page, 'Romanian Whist');
  for (const name of ['Ana', 'Bogdan', 'Cristi']) await enter(page, `${name} Bet round 1`, 0);
  await expect(page.locator('[data-cell="Dana Bet round 1"] .cell-hint')).toHaveText('≠1');
  await page.locator('[data-ink="Dana Bet round 1"]').click();
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeDisabled();
  await page.keyboard.press('0');
  for (const name of PLAYERS) await enter(page, `${name} Tricks round 1`, 0);
  await expect(page.locator('.issue-row')).toHaveText('Tricks add up to 0, not 1.');
  await enter(page, 'Dana Tricks round 1', 1);
  await expect(page.locator('.issue-row')).toHaveCount(0);
  expect(await totalsOnScreen(page)).toEqual([5, 5, 5, -1]);
});

test('a full 4-player Whist game matches the scoring model', async ({ page }) => {
  await newGame(page, 'Romanian Whist');
  const random = rng(11);
  const plan = whistRoundPlan(4);
  let expected: Game = createWhistGame(PLAYERS, 0, false);
  for (const [round, cards] of plan.entries()) {
    const order = bettingOrder(round, 4);
    const bets: number[] = [];
    for (const [position, seat] of order.entries()) {
      let bet = random(cards);
      if (position === 3 && bet === bannedBet(cards, bets)) bet = bet === 0 ? 1 : bet - 1;
      bets.push(bet);
      await enter(page, `${PLAYERS[seat]} Bet round ${round + 1}`, bet);
      expected = setValue(expected, { round, seat, field: 'bet' }, bet);
    }
    const tricks = split(cards, 4, random);
    for (const [seat, value] of tricks.entries()) {
      await enter(page, `${PLAYERS[seat]} Tricks round ${round + 1}`, value);
      expected = setValue(expected, { round, seat, field: 'tricks' }, value);
    }
  }
  const sheet = computeSheet(expected);
  expect(sheet.finished).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Standings' })).toBeVisible();
  expect(await totalsOnScreen(page)).toEqual(sheet.totals);
});

test('a full 4-player Rentz game matches the scoring model', async ({ page }) => {
  await newGame(page, 'Rentz');
  const random = rng(5);
  let expected: RentzGame = createRentzGame(PLAYERS, 0);
  for (let round = 0; round < 32; round++) {
    const row = computeSheet(expected).rows[round];
    const contract = row.availableContracts![random(row.availableContracts!.length - 1)];
    await page.locator('.sheet tbody tr').filter({ has: page.locator(`[data-score="Ana round ${round + 1}"]`) }).getByRole('button', { name: 'Choose' }).click();
    await page.getByRole('button', { name: new RegExp(`^${en[`contract.${contract}`]}`) }).click();
    expected = setContract(expected, round, contract);
    const fields = rentzContractFields(contract);
    const tricks = split(8, 4, random);
    const queens = split(4, 4, random);
    const diamonds = split(rentzDiamondsInDeck(4), 4, random);
    const king = random(3);
    const places = [1, 2, 3, 4].sort(() => random(2) - 1);
    for (let seat = 0; seat < 4; seat++) {
      const values: Record<string, number> = { tricks: tricks[seat], queens: queens[seat], diamonds: diamonds[seat], place: places[seat] };
      for (const field of fields) {
        const label = { tricks: 'Tricks', queens: 'Queens', diamonds: 'Diamonds', kingOfHearts: 'King of Hearts', place: 'Place' }[field];
        if (field === 'kingOfHearts') {
          if (seat === king) await page.locator(`[data-cell="${PLAYERS[seat]} ${label} round ${round + 1}"]`).click();
          expected = setValue(expected, { round, seat, field }, seat === king ? 1 : 0) as RentzGame;
          continue;
        }
        await enter(page, `${PLAYERS[seat]} ${label} round ${round + 1}`, values[field]);
        expected = setValue(expected, { round, seat, field }, values[field]) as RentzGame;
      }
    }
    // Marking the King of Hearts taker marks everyone else as "not taken".
    expect(computeSheet(expected).rows[round].complete).toBe(true);
  }
  const sheet = computeSheet(expected);
  expect(sheet.finished).toBe(true);
  expect(await totalsOnScreen(page)).toEqual(sheet.totals);
});

test('works offline after the first visit and keeps saved games', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await newGame(page, 'Romanian Whist');
  await enter(page, 'Ana Bet round 1', 1);
  await page.getByRole('button', { name: 'Back to games' }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Scorekeeper' })).toBeVisible();
  await page.getByRole('button', { name: /Whist.*Ana, Bogdan, Cristi, Dana/ }).click();
  await expect(page.locator('[data-cell="Ana Bet round 1"] .cell-value')).toHaveText('1');
  // Handwriting still works offline: the model is precached.
  await penWrite(page, 'Bogdan Bet round 1', [line([0.52, 0.15], [0.5, 0.85])]);
  await expect(page.locator('[data-cell="Bogdan Bet round 1"] .cell-value')).toHaveText('1');
  await context.setOffline(false);
});

test('switches to Romanian and remembers it', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Română' }).click();
  await expect(page.getByRole('heading', { name: 'Setări' })).toBeVisible();
  await page.getByRole('button', { name: 'Gata' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');

  await page.reload();
  await page.getByRole('button', { name: 'Joc nou' }).click();
  await page.getByRole('radio', { name: 'Rentz' }).click();
  await expect(page.getByText('32 de runde')).toBeVisible();
  for (const [index, name] of PLAYERS.entries()) await page.getByLabel(`Numele jucătorului ${index + 1}`).fill(name);
  await page.getByRole('button', { name: 'Începe jocul' }).click();
  await expect(page.locator('.sheet thead').getByText('Luate', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Alege' }).first().click();
  await page.getByRole('button', { name: /^Dame/ }).click();
  for (const [name, queens] of [['Ana', 3], ['Bogdan', 2], ['Cristi', 0], ['Dana', 0]] as const) {
    await enter(page, `${name} Queens round 1`, queens);
  }
  await expect(page.locator('.issue-row')).toHaveText('Damele însumează 5, nu 4.');
  // Test hooks stay the same in every language; screen readers get Romanian.
  await expect(page.locator('[data-cell="Ana Queens round 1"]')).toHaveAttribute('aria-label', 'Ana, Dame, runda 1');
});


test('the "0 points wins" option is offered for Whist and shown on the sheet', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('radio', { name: 'Rentz' }).click();
  await expect(page.getByText('Ending on 0 points wins')).toBeHidden();
  await page.getByRole('radio', { name: 'Romanian Whist' }).click();
  await page.getByText('Ending on 0 points wins').click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('House rule: a player who ends on 0 points wins.')).toBeVisible();
});
