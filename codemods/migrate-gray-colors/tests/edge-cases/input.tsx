import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';

// Nested expressions
const complex = (theme: Theme) => css`
  color: ${theme.gray300 || theme.gray200};
  background: ${theme.gray100 ? theme.gray200 : theme.gray300};
`;

// In object literals
const colors = (theme: Theme) => ({
  primary: theme.gray500,
  secondary: theme.gray400,
  tertiary: theme.gray300,
  quaternary: theme.gray200,
  quinary: theme.gray100,
});

// In function calls
function getColor(theme: Theme) {
  return modifyColor(theme.gray300).lighten(0.5).toString();
}

// Mixed with other theme properties
const mixedStyles = (theme: Theme) => css`
  color: ${theme.gray500};
  font-size: ${theme.fontSize.md};
  border: 1px solid ${theme.gray200};
  padding: ${theme.space[2]};
  background: ${theme.translucentGray100};
`;

// Chained with other properties (should only transform the theme.gray part)
const chained = (theme: Theme) => {
  const color1 = modifyColor(theme.gray400).alpha(0.5).string();
  const color2 = modifyColor(theme.gray300).darken(0.2).string();
  return {color1, color2};
};

// Multiple on same line
const inline = (theme: Theme) => `${theme.gray100} ${theme.gray200} ${theme.gray300}`;
