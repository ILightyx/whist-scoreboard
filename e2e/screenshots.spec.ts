import { test } from '@playwright/test';
// Not a check: captures screens for a visual review. Run with SCREENSHOTS=1.
test.skip(!process.env.SCREENSHOTS, 'screenshots only on request');
const OUT = 'test-results/screenshots/';
test('capture screens', async ({ page }) => {
  for (const [label, size] of [['landscape', { width: 1366, height: 1024 }], ['portrait', { width: 820, height: 1180 }]] as const) {
    await page.setViewportSize(size);
    await page.goto('./');
    await page.getByRole('button', { name: 'New game' }).click();
    await page.screenshot({ path: OUT + label + '-setup.png' });
    for (const [i, n] of ['Ana', 'Bogdan', 'Cristi', 'Dana'].entries()) await page.getByLabel('Player ' + (i + 1) + ' name').fill(n);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const enter = async (cell: string, v: number) => { await page.locator('[data-ink="' + cell + '"]').click(); await page.keyboard.press(String(v)); };
    for (const [n, b] of [['Ana', 0], ['Bogdan', 1], ['Cristi', 0], ['Dana', 1]] as const) await enter(n + ' Bet round 1', b);
    for (const [n, t] of [['Ana', 0], ['Bogdan', 1], ['Cristi', 0], ['Dana', 0]] as const) await enter(n + ' Tricks round 1', t);
    for (const [n, b] of [['Bogdan', 0], ['Cristi', 0], ['Dana', 0]] as const) await enter(n + ' Bet round 2', b);
    await page.screenshot({ path: OUT + label + '-whist.png' });
    await page.locator('[data-ink="Ana Bet round 2"]').click();
    await page.screenshot({ path: OUT + label + '-pad.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to games' }).click();
    await page.getByRole('button', { name: 'New game' }).click();
    await page.getByRole('radio', { name: 'Rentz' }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await page.screenshot({ path: OUT + label + '-rentz-picker.png' });
    await page.getByRole('button', { name: /^Big Totals/ }).click();
    await page.screenshot({ path: OUT + label + '-rentz.png' });
    await page.getByRole('button', { name: 'Back to games' }).click();
    await page.screenshot({ path: OUT + label + '-home.png' });
  }
});
