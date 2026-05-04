import {RuleTester} from '@typescript-eslint/rule-tester';

import {requireFakeTimerCleanup} from './require-fake-timer-cleanup';

const ruleTester = new RuleTester();

ruleTester.run('require-fake-timer-cleanup', requireFakeTimerCleanup, {
  valid: [
    {
      name: 'no fake timers used',
      code: `
        describe('test', () => {
          it('works', () => {
            expect(1).toBe(1);
          });
        });
      `,
    },
    {
      name: 'proper beforeEach + afterEach cleanup',
      code: `
        describe('test', () => {
          beforeEach(() => {
            jest.useFakeTimers();
          });
          afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
    },
    {
      name: 'beforeAll + afterAll variant',
      code: `
        describe('test', () => {
          beforeAll(() => {
            jest.useFakeTimers();
          });
          afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
    },
    {
      name: 'beforeEach + afterAll variant',
      code: `
        describe('test', () => {
          beforeEach(() => {
            jest.useFakeTimers();
          });
          afterAll(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
    },
    {
      name: 'cleanup with act() wrapper',
      code: `
        describe('test', () => {
          beforeEach(() => {
            jest.useFakeTimers();
          });
          afterEach(() => {
            act(() => {
              jest.runOnlyPendingTimers();
            });
            jest.useRealTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
    },
    {
      name: 'nested describe with proper setup/cleanup',
      code: `
        describe('outer', () => {
          describe('inner', () => {
            beforeEach(() => {
              jest.useFakeTimers();
            });
            afterEach(() => {
              jest.runOnlyPendingTimers();
              jest.useRealTimers();
            });
            it('works', () => {
              jest.advanceTimersByTime(1000);
            });
          });
        });
      `,
    },
  ],
  invalid: [
    {
      name: 'module-level jest.useFakeTimers()',
      code: `
        jest.useFakeTimers();
        describe('test', () => {
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'useFakeTimersNotInHook'}, {messageId: 'missingCleanup'}],
    },
    {
      name: 'jest.useFakeTimers() inside describe body (not in a hook)',
      code: `
        describe('test', () => {
          jest.useFakeTimers();
          afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'useFakeTimersNotInHook'}],
    },
    {
      name: 'jest.useFakeTimers() inside it() block',
      code: `
        describe('test', () => {
          afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
          });
          it('works', () => {
            jest.useFakeTimers();
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'useFakeTimersNotInHook'}],
    },
    {
      name: 'jest.useFakeTimers() inside test() block',
      code: `
        describe('test', () => {
          afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
          });
          test('works', () => {
            jest.useFakeTimers();
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'useFakeTimersNotInHook'}],
    },
    {
      name: 'beforeEach but no afterEach cleanup',
      code: `
        describe('test', () => {
          beforeEach(() => {
            jest.useFakeTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'afterEach has useRealTimers but missing runOnlyPendingTimers',
      code: `
        describe('test', () => {
          beforeEach(() => {
            jest.useFakeTimers();
          });
          afterEach(() => {
            jest.useRealTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'afterEach has runOnlyPendingTimers but missing useRealTimers',
      code: `
        describe('test', () => {
          beforeEach(() => {
            jest.useFakeTimers();
          });
          afterEach(() => {
            jest.runOnlyPendingTimers();
          });
          it('works', () => {
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'useRealTimers in it() block does not count as cleanup',
      code: `
        describe('test', () => {
          it('works', () => {
            jest.useFakeTimers();
            jest.advanceTimersByTime(1000);
            jest.useRealTimers();
          });
        });
      `,
      errors: [{messageId: 'useFakeTimersNotInHook'}, {messageId: 'missingCleanup'}],
    },
    {
      name: 'jest.useFakeTimers() inside it.only()',
      code: `
        describe('test', () => {
          afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
          });
          it.only('works', () => {
            jest.useFakeTimers();
            jest.advanceTimersByTime(1000);
          });
        });
      `,
      errors: [{messageId: 'useFakeTimersNotInHook'}],
    },
  ],
});
