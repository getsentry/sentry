import {RuleTester} from 'oxlint/plugins-dev';

import {requireFakeTimerCleanup} from './requireFakeTimerCleanup';

const ruleTester = new RuleTester();

ruleTester.run('require-fake-timer-cleanup', requireFakeTimerCleanup, {
  valid: [
    {
      name: 'await act returning async flush after local declaration',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(async () => {const value = 1; await act(() => jest.runOnlyPendingTimersAsync()); jest.useRealTimers();});`,
    },

    {
      name: 'ancestor cleanup applies to nested test',
      code: `afterEach(() => {jest.runOnlyPendingTimers(); jest.useRealTimers();}); describe('inner', () => {test.each([1])('case', () => {jest.useFakeTimers();});});`,
    },
    {
      name: 'awaited async flush wrapped in act',
      code: `test('case', () => {jest.useFakeTimers();}); afterEach(async () => {await act(async () => {await jest.runOnlyPendingTimersAsync();}); jest.useRealTimers();});`,
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
    },
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
      name: 'child cleanup does not apply to parent',
      code: `beforeEach(() => jest.useFakeTimers()); describe('child', () => {afterEach(() => {jest.runOnlyPendingTimers(); jest.useRealTimers();});});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'uninvoked cleanup helper does not apply',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {const cleanup = () => {jest.runOnlyPendingTimers(); jest.useRealTimers();};});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'conditional restore is not guaranteed',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {if (condition) {jest.runOnlyPendingTimers(); jest.useRealTimers();}});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'conditional flush does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {if (condition) jest.runOnlyPendingTimers(); jest.useRealTimers();});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'unawaited async flush does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {jest.runOnlyPendingTimersAsync(); jest.useRealTimers();});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'unawaited async act does not count',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {act(async () => {await jest.runOnlyPendingTimersAsync();}); jest.useRealTimers();});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'separate hooks do not prove flush ordering',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => jest.runOnlyPendingTimers()); afterEach(() => jest.useRealTimers());`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },
    {
      name: 'nested setup helper is not a test callback',
      code: `test('case', () => {const setup = () => jest.useFakeTimers();}); afterEach(() => {jest.runOnlyPendingTimers(); jest.useRealTimers();});`,
      errors: [{messageId: 'useFakeTimersNotInHook'}],
    },
    {
      name: 'beforeAll requires afterAll',
      code: `beforeAll(() => jest.useFakeTimers()); afterEach(() => {jest.runOnlyPendingTimers(); jest.useRealTimers();});`,
      errors: [{messageId: 'missingCleanup'}],
    },

    {
      name: 'sibling cleanup does not apply',
      code: `describe('one', () => {beforeEach(() => jest.useFakeTimers());}); describe('two', () => {afterEach(() => {jest.runOnlyPendingTimers(); jest.useRealTimers();});});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'afterAll cannot clean up beforeEach',
      code: `beforeEach(() => jest.useFakeTimers()); afterAll(() => {jest.runOnlyPendingTimers(); jest.useRealTimers();});`,
      errors: [{messageId: 'missingCleanup'}],
    },
    {
      name: 'flush must precede restore',
      code: `beforeEach(() => jest.useFakeTimers()); afterEach(() => {jest.useRealTimers(); jest.runOnlyPendingTimers();});`,
      errors: [{messageId: 'missingRunOnlyPendingTimers'}],
    },

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
      errors: [{messageId: 'missingCleanup'}],
    },
  ],
});
