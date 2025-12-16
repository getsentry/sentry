import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';

// Basic gray color transformations
const styles = (theme: Theme) => css`
  color: ${theme.colors.gray800};
  background: ${theme.colors.gray500};
  border-color: ${theme.colors.gray400};
  box-shadow: 0 0 0 1px ${theme.colors.gray200};
  outline-color: ${theme.colors.gray100};
`;

// With props
const StyledComponent = styled('div')<{theme: Theme}>`
  color: ${p => p.theme.colors.gray800};
  background: ${p => p.theme.colors.gray500};
  border: 1px solid ${p => p.theme.colors.gray400};
`;

// With props object
const AnotherComponent = styled('div')<{theme: Theme}>`
  color: ${props => props.theme.colors.gray200};
  background: ${props => props.theme.colors.gray100};
`;

// Translucent grays
const TranslucentStyles = (theme: Theme) => css`
  background: ${theme.colors.gray200};
  border-color: ${theme.colors.gray100};
`;
