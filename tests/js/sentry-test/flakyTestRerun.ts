/* eslint-disable jest/no-export, jest/valid-title */
const FLAKY_RERUN_COUNT = 50;

/**
 * Wraps a test that is known to be flaky. When the RERUN_KNOWN_FLAKY_TESTS
 * env var is set (via the "Frontend: Rerun Flaky Tests" PR label), the test
 * runs multiple times to verify the fix is stable. Otherwise, it runs once.
 */
export function itRepeatsWhenFlaky(
  name: string,
  fn: () => void | Promise<void>,
  timeout?: number
) {
  const shouldRepeat = process.env.RERUN_KNOWN_FLAKY_TESTS === 'true';
  const count = shouldRepeat ? FLAKY_RERUN_COUNT : 1;

  if (count > 1) {
    describe(`[flaky rerun x${count}] ${name}`, () => {
      for (let i = 1; i <= count; i++) {
        it(`run ${i}/${count}`, fn, timeout);
      }
    });
  } else {
    it(name, fn, timeout);
  }
}
