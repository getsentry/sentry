import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';

// Basic gray color transformations
const styles = (theme: Theme) => css`
  color: ${theme.gray500};
  background: ${theme.gray400};
  border-color: ${theme.gray300};
  box-shadow: 0 0 0 1px ${theme.gray200};
  outline-color: ${theme.gray100};
`;

// With props
const StyledComponent = styled('div')<{theme: Theme}>`
  color: ${p => p.theme.gray500};
  background: ${p => p.theme.gray400};
  border: 1px solid ${p => p.theme.gray300};
`;

// With props object
const AnotherComponent = styled('div')<{theme: Theme}>`
  color: ${props => props.theme.gray200};
  background: ${props => props.theme.gray100};
`;

// Translucent grays
const TranslucentStyles = (theme: Theme) => css`
  background: ${theme.translucentGray200};
  border-color: ${theme.translucentGray100};
`;
