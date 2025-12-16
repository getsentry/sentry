import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';

// Nested expressions
const complex = (theme: Theme) => css`
  color: ${theme.colors.gray400 || theme.colors.gray200};
  background: ${theme.colors.gray100 ? theme.colors.gray200 : theme.colors.gray400};
`;

// In object literals
const colors = (theme: Theme) => ({
  primary: theme.colors.gray800,
  secondary: theme.colors.gray500,
  tertiary: theme.colors.gray400,
  quaternary: theme.colors.gray200,
  quinary: theme.colors.gray100,
});

// In function calls
function getColor(theme: Theme) {
  return modifyColor(theme.colors.gray400).lighten(0.5).toString();
}

// Mixed with other theme properties
const mixedStyles = (theme: Theme) => css`
  color: ${theme.colors.gray800};
  font-size: ${theme.fontSize.md};
  border: 1px solid ${theme.colors.gray200};
  padding: ${theme.space[2]};
  background: ${theme.colors.gray100};
`;

// Chained with other properties (should only transform the theme.gray part)
const chained = (theme: Theme) => {
  const color1 = modifyColor(theme.colors.gray500).alpha(0.5).string();
  const color2 = modifyColor(theme.colors.gray400).darken(0.2).string();
  return {color1, color2};
};

// Multiple on same line
const inline = (theme: Theme) =>
  `${theme.colors.gray100} ${theme.colors.gray200} ${theme.colors.gray400}`;
