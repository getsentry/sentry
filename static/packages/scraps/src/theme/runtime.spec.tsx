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
