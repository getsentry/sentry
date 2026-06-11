// eslint-disable-next-line no-restricted-imports
import {lightTheme} from 'sentry/utils/theme/theme';

export const ThemeFixture = () => {
  // Guard against `lightTheme` being undefined at call time (e.g. due to a
  // circular import). Emotion 11.14's @emotion/weak-memoize now strictly
  // requires WeakMap keys to be objects and will throw
  // "Invalid value used as weak map key" if `theme` is not an object.
  if (lightTheme === null || typeof lightTheme !== 'object') {
    throw new Error(
      `ThemeFixture: expected \`lightTheme\` to be an object but got ${typeof lightTheme}. ` +
        'This usually indicates a circular import involving sentry/utils/theme/theme.'
    );
  }
  // Return a fresh object so callers cannot accidentally mutate the shared
  // `lightTheme` reference between tests.
  return {...lightTheme};
};
