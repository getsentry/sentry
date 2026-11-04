import {RuleTester} from 'oxlint/plugins-dev';

import {preferFakeTimers} from './preferFakeTimers';

const ruleTester = new RuleTester();

ruleTester.run('prefer-fake-timers', preferFakeTimers, {
  valid: [
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('spread overrides timeout', async () => {
        const opts = {timeout: 0};
        await waitFor(check, {timeout: 1500, ...opts});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('computed override is unknown', async () => {
        await waitFor(check, {timeout: 1500, [option]: 0});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('last timeout wins', async () => {
        await waitFor(check, {timeout: 1500, timeout: 0});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('staged responses have no explicit wait #114733', async () => {
        MockApiClient.addMockResponse({asyncDelay: 250});
        await waitFor(check);
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('implicit debounce has no explicit wait #124875', async () => {
        await userEvent.type(input, 'query');
        await screen.findByText('result');
      });
    `,
    `
      import {jest as clock, test as caseOf, beforeEach as setup} from '@jest/globals';

      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      setup(() => clock.useFakeTimers());
      caseOf('import aliases', async () => {
        await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('returned bound query', async () => {
        const {findByText} = render(view);
        jest.useFakeTimers();
        await findByText('ready', {}, {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('scheduled callback', () => {
        setTimeout(callback, 1500);
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('zero sleep', async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('shadowed Promise', async () => {
        const Promise = custom;
        await new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('shadowed timer', async () => {
        const setTimeout = custom;
        await new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('fake sleep', async () => {
        jest.useFakeTimers();
        await new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('not awaited', () => {
        new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('nested helper', async () => {
        function helper() {
          return waitFor(check, {timeout: 1500});
        }
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('unrelated RTL export', async () => {
        const x = renderHook(callback);
        await x.findByText('x', {}, {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('ordinary async', async () => {
        await waitFor(() => expect(ready).toBe(true));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('zero timeout', async () => {
        await waitFor(check, {timeout: 0});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('unknown timeout', async () => {
        await waitFor(check, {timeout: external});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('cyclic constants', async () => {
        const x = y;
        const y = x;
        await waitFor(check, {timeout: x});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('fake timers', async () => {
        jest.useFakeTimers();
        await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      describe('suite', () => {
        beforeEach(() => jest.useFakeTimers());
        it('fake timers', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      beforeAll(() => jest.useFakeTimers());
      describe('nested', () => {
        it('fake timers', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('shadowed helper', async () => {
        const waitFor = custom;
        await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('shadowed screen', async () => {
        const screen = custom;
        await screen.findByText('ready', {}, {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('query options', async () => {
        await screen.findByText('ready', {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('unrelated method', async () => {
        await other.findByText('ready', {}, {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      function helper() {
        return waitFor(check, {timeout: 1500});
      }
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      beforeEach(() => jest.useFakeTimers());
      it('late declaration', async () => {
        await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('late hook', async () => {
        await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
      });
      beforeEach(() => jest.useFakeTimers());
    `,
  ],
  invalid: [
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('computed literal timeout', async () => {
          await waitFor(check, {['timeout']: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 51},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('last positive timeout wins', async () => {
          await waitFor(check, {timeout: 0, timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 59},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('Stripe warning #126038', async () => {
          await waitFor(check, {timeout: 11000});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 48},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('build polling #108621', async () => {
          await waitFor(check, {timeout: 12000});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 48},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        beforeEach(() => jest.useFakeTimers());
        it('conditional restore', async () => {
          if (maybe) jest.useRealTimers();
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 6, column: 16, endLine: 6, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('sequential query #125099 requires review', async () => {
          await screen.findByTestId('installs', {}, {timeout: 3000});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 68},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('function helper must not enable', async () => {
          function helper() {
            jest.useFakeTimers();
          }
          await waitFor(check, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 7, column: 16, endLine: 7, endColumn: 47},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('password countdown #126883', async () => {
          await screen.findByText('Taking you back to sign in (2)…', {}, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 89},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('install retry #126878', async () => {
          await screen.findByRole('button', {name: 'Retry'}, {timeout: 10_000});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 79},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('workflow polling #126877', async () => {
          await waitFor(check, {timeout: 7000});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 47},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('find all', async () => {
          await within(container).findAllByText('ready', {}, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 77},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('render queries', async () => {
          const {findByText: find} = render(view);
          await find('ready', {}, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 5, column: 16, endLine: 5, endColumn: 50},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('constant options', async () => {
          const duration = 1500;
          const options = {timeout: duration};
          await waitFor(check, options);
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 6, column: 16, endLine: 6, endColumn: 39},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('sibling enabled', () => {
          jest.useFakeTimers();
        });
        it('real timers', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 7, column: 16, endLine: 7, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        describe('sibling', () => {
          beforeEach(() => jest.useFakeTimers());
        });
        it('real timers', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 7, column: 16, endLine: 7, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('late enabling', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
          jest.useFakeTimers();
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        beforeEach(() => jest.useFakeTimers());
        it('restored', async () => {
          jest.useRealTimers();
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 6, column: 16, endLine: 6, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        beforeAll(() => jest.useFakeTimers());
        beforeEach(() => jest.useRealTimers());
        it('restored', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 6, column: 16, endLine: 6, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        beforeEach(() => jest.useRealTimers());
        describe('nested', () => {
          beforeAll(() => jest.useFakeTimers());
          it('restored', async () => {
            await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
          });
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 7, column: 18, endLine: 7, endColumn: 74},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('conditional enabling', async () => {
          if (maybe) jest.useFakeTimers();
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 5, column: 16, endLine: 5, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('uncalled helper', async () => {
          const enable = () => jest.useFakeTimers();
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 5, column: 16, endLine: 5, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('shadowed jest', async () => {
          const jest = custom;
          jest.useFakeTimers();
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 6, column: 16, endLine: 6, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it.each([1, 2])('parameterized', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        test.only('focused', async () => {
          await waitFor(() => expect(ready).toBe(true), {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 72},
      ],
    },
    {
      code: `
        import {waitFor as until} from '@testing-library/react';
        it('alias', async () => {
          await until(check, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 45},
      ],
    },
    {
      code: `
        import * as rtl from '@testing-library/react';
        it('namespace', async () => {
          await rtl.waitFor(check, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 51},
      ],
    },
    {
      code: `
        import {findByText} from '@testing-library/dom';
        it('DOM query', async () => {
          await findByText(container, 'ready', {}, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 16, endLine: 4, endColumn: 67},
      ],
    },
    {
      code: `
        it('disabled polling #126039', async () => {
          await new Promise(resolve => setTimeout(resolve, 1500));
        });
      `,
      errors: [{messageId: 'sleep', line: 3, column: 16, endLine: 3, endColumn: 65}],
    },
    {
      code: `
        it('block executor', async () => {
          await new Promise(resolve => {
            setTimeout(resolve, 1500);
          });
        });
      `,
      errors: [{messageId: 'sleep', line: 3, column: 16, endLine: 5, endColumn: 12}],
    },
    {
      code: `
        it('constant duration', async () => {
          const duration = 1500;
          await new Promise(resolve => setTimeout(resolve, duration));
        });
      `,
      errors: [{messageId: 'sleep', line: 4, column: 16, endLine: 4, endColumn: 69}],
    },
  ],
});
