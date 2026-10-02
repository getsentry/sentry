import type {darkTheme} from './dark';
import type {lightTheme} from './light';

export {lightTheme} from './light';
export {darkTheme} from './dark';
export {baseTheme} from './base';
export type * from './types';
export type Theme = {
  [Key in keyof typeof lightTheme]: (typeof lightTheme)[Key] | (typeof darkTheme)[Key];
};
type ScrapsTheme = Theme;

declare module '@emotion/react' {
  export interface Theme extends ScrapsTheme {}
}
