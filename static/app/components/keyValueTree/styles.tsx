import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

export const TreeSpacer = styled('div')<{hasStem: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid
    ${p => (p.hasStem ? p.theme.tokens.border.primary : 'transparent')};
  margin-right: -1px;
  height: 100%;
  width: ${p => (p.spacerCount - 1) * 20 + 3}px;
`;

export const TreeBranchIcon = styled('div')<{hasErrors: boolean}>`
  border: 1px solid
    ${p => (p.hasErrors ? p.theme.colors.red200 : p.theme.tokens.border.primary)};
  border-width: 0 0 1px 1px;
  border-radius: 0 0 0 5px;
  grid-column: span 1;
  height: 12px;
  align-self: start;
  margin-right: ${p => p.theme.space.xs};
`;

const trunkStyles = (p: {theme: Theme}) => css`
  display: grid;
  align-items: center;
  align-self: stretch;
  /* Cancels KeyValueRow's vertical padding so branch stems connect between rows */
  margin-block: calc(-1 * ${p.theme.space['2xs']});
`;

export const TreeKeyTrunk = styled('div')<{spacerCount: number}>`
  ${trunkStyles};
  grid-column: 1 / 2;
  grid-template-columns: ${p => (p.spacerCount > 0 ? 'auto 1rem 1fr' : '1fr')};
`;

export const TreeValueTrunk = styled('div')`
  ${trunkStyles};
  grid-column: 2 / 3;
  min-height: 22px;
  grid-column-gap: ${p => p.theme.space.xs};
  grid-template-columns: minmax(0, 1fr) auto;
`;

export const TreeValue = styled('div')<{hasErrors?: boolean}>`
  padding: ${p => p.theme.space['2xs']} 0;
  align-self: start;
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  word-break: break-word;
  grid-column: span 1;
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.tokens.content.primary)};
`;

export const TreeKey = styled(TreeValue)<{hasErrors?: boolean}>`
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.tokens.content.secondary)};
`;

export const TreeSearchKey = styled('span')`
  font-size: 0;
  position: absolute;
`;

export const TreeValueDropdown = styled(DropdownMenu)`
  display: block;
  margin: 1px;
  height: 20px;
`;
