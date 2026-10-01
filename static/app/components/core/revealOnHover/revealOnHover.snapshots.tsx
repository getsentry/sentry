import {Fragment} from 'react';
import {renderToString} from 'react-dom/server';
import {chromium, type Browser} from 'playwright';

import {renderWithSnapshotTheme} from 'sentry-test/snapshots/snapshotThemeProvider';

import {Button} from '@sentry/scraps/button';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Text} from '@sentry/scraps/text';

// These tests need a browser: jsdom does not distinguish mouse focus from
// keyboard focus or apply the hover media query.
describe('RevealOnHover browser visibility', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each([false, true])(
    'hides mouse-focused actions after leaving (callback children: %s)',
    async callbackChildren => {
      const content = (
        <Fragment>
          <Text>Cell content</Text>
          <RevealOnHover.Action>
            <Button aria-label="Actions">Actions</Button>
          </RevealOnHover.Action>
        </Fragment>
      );
      const element = callbackChildren ? (
        <RevealOnHover>{props => <div {...props}>{content}</div>}</RevealOnHover>
      ) : (
        <RevealOnHover>{content}</RevealOnHover>
      );
      const page = await browser.newPage();

      try {
        await page.setContent(renderToString(renderWithSnapshotTheme('light', element)));
        const trigger = page.getByRole('button', {name: 'Actions'});
        const action = page.locator('[data-reveal-on-hover]');

        await page.getByText('Cell content').hover();
        await trigger.click();
        await trigger.click();
        await page.mouse.move(1000, 700);

        expect(await trigger.evaluate(button => button === document.activeElement)).toBe(
          true
        );
        await page.waitForFunction(
          el => el && getComputedStyle(el).opacity === '0',
          await action.elementHandle(),
          {timeout: 2000}
        );
        expect(await action.evaluate(el => getComputedStyle(el).pointerEvents)).toBe(
          'none'
        );

        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await page.waitForFunction(
          el => el && getComputedStyle(el).opacity === '1',
          await action.elementHandle(),
          {timeout: 2000}
        );
        expect(await action.evaluate(el => getComputedStyle(el).pointerEvents)).toBe(
          'auto'
        );
      } finally {
        await page.close();
      }
    }
  );
});
