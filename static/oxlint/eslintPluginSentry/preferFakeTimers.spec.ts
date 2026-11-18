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
    `
      jest.useFakeTimers();
      it('module-level fake timers', async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('cyclic aliases', async () => {
        const first = second;
        const second = first;
        await first(check, {timeout: 1500});
      });
    `,
    `
      it('unimported namespace', async () => {
        await rtl.waitFor(check, {timeout: 1500});
      });
    `,
    `
      import {waitFor} from 'other-library';
      it('unrelated library', async () => {
        await waitFor(check, {timeout: 1500});
      });
    `,
    `
      import * as globals from '@jest/globals';
      it('jest globals namespace', async () => {
        globals.jest.useFakeTimers();
        await new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      import library from '@testing-library/react';
      it('default import', async () => {
        await library.waitFor(check, {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('reassigned alias', async () => {
        let until = waitFor;
        until = custom;
        await until(check, {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('destructured default', async () => {
        const {findByText = custom} = render(view);
        await findByText('ready', {}, {timeout: 1500});
      });
    `,
    `
      it('let duration', async () => {
        let duration = 1500;
        await new Promise(resolve => setTimeout(resolve, duration));
      });
    `,
    `
      it('other constructor', async () => {
        await new Deferred(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      beforeEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      it('executor reference', async () => {
        await new Promise(executor);
      });
    `,
    `
      it('other scheduler', async () => {
        await new Promise(resolve => schedule(resolve, 1500));
      });
    `,
    `
      it('no resolve parameter', async () => {
        await new Promise(() => setTimeout(done, 1500));
      });
    `,
    `
      it('other callback', async () => {
        await new Promise(resolve => setTimeout(other, 1500));
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('get query', async () => {
        screen.getByText('ready', {}, {timeout: 1500});
      });
    `,
    `
      import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
      it('interval only', async () => {
        await waitFor(check, {interval: 100});
      });
    `,
    `
      import {act} from 'sentry-test/reactTestingLibrary';
      it('unawaited act', () => {
        act(() => new Promise(resolve => setTimeout(resolve, 1500)));
      });
    `,
    `
      import {act} from 'sentry-test/reactTestingLibrary';
      it('fake act sleep', async () => {
        jest.useFakeTimers();
        await act(() => new Promise(resolve => setTimeout(resolve, 1500)));
      });
    `,
    `
      import {act} from 'sentry-test/reactTestingLibrary';
      it('other wrapper', async () => {
        await wrap(() => new Promise(resolve => setTimeout(resolve, 1500)));
      });
    `,
    `
      import {act} from 'sentry-test/reactTestingLibrary';
      beforeEach(async () => {
        await act(() => new Promise(resolve => setTimeout(resolve, 1500)));
      });
    `,
    `
      beforeEach(async () => {
        await jest.useFakeTimers();
      });
      it('awaited fake timers', async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
      });
    `,
    `
      import {act} from 'sentry-test/reactTestingLibrary';
      it('act with nested promise', async () => {
        await act(() => wrap(new Promise(resolve => setTimeout(resolve, 1500))));
      });
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
        {messageId: 'preferFakeTimers', line: 4, column: 31, endLine: 4, endColumn: 50},
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
        {messageId: 'preferFakeTimers', line: 4, column: 31, endLine: 4, endColumn: 58},
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
        {messageId: 'preferFakeTimers', line: 4, column: 31, endLine: 4, endColumn: 47},
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
        {messageId: 'preferFakeTimers', line: 4, column: 31, endLine: 4, endColumn: 47},
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
        {messageId: 'preferFakeTimers', line: 6, column: 56, endLine: 6, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 4, column: 52, endLine: 4, endColumn: 67},
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
        {messageId: 'preferFakeTimers', line: 7, column: 31, endLine: 7, endColumn: 46},
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
        {messageId: 'preferFakeTimers', line: 4, column: 73, endLine: 4, endColumn: 88},
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
        {messageId: 'preferFakeTimers', line: 4, column: 61, endLine: 4, endColumn: 78},
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
        {messageId: 'preferFakeTimers', line: 4, column: 31, endLine: 4, endColumn: 46},
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
        {messageId: 'preferFakeTimers', line: 4, column: 61, endLine: 4, endColumn: 76},
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
        {messageId: 'preferFakeTimers', line: 5, column: 34, endLine: 5, endColumn: 49},
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
        {messageId: 'preferFakeTimers', line: 6, column: 31, endLine: 6, endColumn: 38},
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
        {messageId: 'preferFakeTimers', line: 7, column: 56, endLine: 7, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 7, column: 56, endLine: 7, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 4, column: 56, endLine: 4, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 6, column: 56, endLine: 6, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 6, column: 56, endLine: 6, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 7, column: 58, endLine: 7, endColumn: 73},
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
        {messageId: 'preferFakeTimers', line: 5, column: 56, endLine: 5, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 5, column: 56, endLine: 5, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 6, column: 56, endLine: 6, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 4, column: 56, endLine: 4, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 4, column: 56, endLine: 4, endColumn: 71},
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
        {messageId: 'preferFakeTimers', line: 4, column: 29, endLine: 4, endColumn: 44},
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
        {messageId: 'preferFakeTimers', line: 4, column: 35, endLine: 4, endColumn: 50},
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
        {messageId: 'preferFakeTimers', line: 4, column: 51, endLine: 4, endColumn: 66},
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
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('string key', async () => {
          await waitFor(check, {'timeout': 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 31, endLine: 4, endColumn: 48},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('numeric computed key', async () => {
          await waitFor(check, {[0]: 0, timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 31, endLine: 4, endColumn: 54},
      ],
    },
    {
      code: `
        import {test as caseOf} from '@jest/globals';
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        caseOf('jest globals test alias', async () => {
          await waitFor(check, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 5, column: 31, endLine: 5, endColumn: 46},
      ],
    },
    {
      code: `
        import {'waitFor' as until} from '@testing-library/react';
        it('string import name', async () => {
          await until(check, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 4, column: 29, endLine: 4, endColumn: 44},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('local alias', async () => {
          const until = waitFor;
          await until(check, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 5, column: 29, endLine: 5, endColumn: 44},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it.each\`
          value
          \${1}
        \`('tagged table', async () => {
          await waitFor(check, {timeout: 1500});
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 7, column: 31, endLine: 7, endColumn: 46},
      ],
    },
    {
      code: `
        import {waitFor, screen, within, render} from 'sentry-test/reactTestingLibrary';
        it('multiline callback', async () => {
          await waitFor(
            () => {
              expect(ready).toBe(true);
            },
            {timeout: 1500}
          );
        });
      `,
      errors: [
        {messageId: 'preferFakeTimers', line: 8, column: 12, endLine: 8, endColumn: 27},
      ],
    },
    {
      code: `
        describe('sibling', () => {
          beforeAll(() => jest.useFakeTimers());
        });
        it('real timers', async () => {
          await new Promise(resolve => setTimeout(resolve, 1500));
        });
      `,
      errors: [{messageId: 'sleep', line: 6, column: 16, endLine: 6, endColumn: 65}],
    },
    {
      code: `
        it('function executor', async () => {
          await new Promise(function (resolve) {
            setTimeout(resolve, 1500);
          });
        });
      `,
      errors: [{messageId: 'sleep', line: 3, column: 16, endLine: 5, endColumn: 12}],
    },
    {
      code: `
        import {act} from 'sentry-test/reactTestingLibrary';
        it('act sleep', async () => {
          await act(() => new Promise(resolve => setTimeout(resolve, 1500)));
        });
      `,
      errors: [{messageId: 'sleep', line: 4, column: 26, endLine: 4, endColumn: 75}],
    },
  ],
});
