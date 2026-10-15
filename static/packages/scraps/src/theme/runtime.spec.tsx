import {darkTheme, generateMotion, lightTheme} from './index';

it.each([lightTheme, darkTheme])('provides focus styles for each theme', theme => {
  expect(theme.focusRing()).toEqual({
    outline: 'none',
    boxShadow: `0 0 0 0 ${theme.tokens.background.primary}, 0 0 0 2px ${theme.tokens.focus.default}`,
  });
});

it('can disable Framer transitions without changing the CSS motion tokens', () => {
  const motion = generateMotion();
  const disabled = generateMotion(true);

  expect(disabled.smooth).toEqual(motion.smooth);
  expect(motion.framer.smooth.fast.duration).toBe(0.12);
  expect(disabled.framer.smooth.fast).toEqual({
    duration: 0,
    staggerChildren: 0,
    type: false,
  });
});

it.each([
  ['production', undefined, false],
  ['development', undefined, false],
  ['test', undefined, true],
  ['production', '1', true],
  ['development', '1', true],
] as const)(
  'configures motion for NODE_ENV=%s and IS_ACCEPTANCE_TEST=%s',
  async (nodeEnv, acceptanceTest, disabled) => {
    const environment = jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: nodeEnv,
      IS_ACCEPTANCE_TEST: acceptanceTest,
    });

    try {
      await jest.isolateModulesAsync(async () => {
        const {darkTheme, lightTheme} = await import('./theme');

        for (const theme of [lightTheme, darkTheme]) {
          expect(theme.motion.framer.smooth.fast.duration).toBe(disabled ? 0 : 0.12);
          expect(theme.motion.smooth.fast).toBe('120ms cubic-bezier(0.72, 0, 0.16, 1)');
        }
      });
    } finally {
      environment.restore();
    }
  }
);
