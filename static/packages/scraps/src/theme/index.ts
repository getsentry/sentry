import {darkTheme as darkTokens} from './dark';
import {lightTheme as lightTokens} from './light';
import {generateMotion, zIndex} from './runtime';

export {generateMotion, zIndex} from './runtime';

const sharedTheme = {motion: generateMotion(), zIndex};

export const lightTheme = {
  ...lightTokens,
  ...sharedTheme,
  type: 'light' as 'light' | 'dark',
  focusRing: (baseShadow = `0 0 0 0 ${lightTokens.tokens.background.primary}`) => ({
    outline: 'none',
    boxShadow: `${baseShadow}, 0 0 0 2px ${lightTokens.tokens.focus.default}`,
  }),
};

export const darkTheme = {
  ...darkTokens,
  ...sharedTheme,
  type: 'dark' as 'light' | 'dark',
  focusRing: (baseShadow = `0 0 0 0 ${darkTokens.tokens.background.primary}`) => ({
    outline: 'none',
    boxShadow: `${baseShadow}, 0 0 0 2px ${darkTokens.tokens.focus.default}`,
  }),
};
export {baseTheme} from './base';
export type * from './types';
export type Theme = {
  [Key in keyof typeof lightTheme]: (typeof lightTheme)[Key] | (typeof darkTheme)[Key];
};
type ScrapsTheme = Theme;

declare module '@emotion/react' {
  export interface Theme extends ScrapsTheme {}
}
