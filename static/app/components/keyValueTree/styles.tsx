import styled from '@emotion/styled';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

export const TreeContainer = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
`;

export const TreeColumn = styled('div')`
  display: grid;
  grid-column-gap: ${p => p.theme.space['2xl']};
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-left: ${p => p.theme.space.xl};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-right: ${p => p.theme.space.xl};
  }
`;

export const TreeRow = styled('div')<{hasErrors: boolean}>`
  border-radius: ${p => p.theme.space.xs};
  padding-left: ${p => p.theme.space.md};
  position: relative;
  display: grid;
  align-items: center;
  grid-column: span 2;
  column-gap: ${p => p.theme.space.lg};
  grid-template-columns: subgrid;
  :nth-child(odd) {
    background-color: ${p =>
      p.hasErrors ? p.theme.colors.red100 : p.theme.tokens.background.secondary};
  }
  color: ${p => (p.hasErrors ? p.theme.colors.red500 : p.theme.tokens.content.secondary)};
  background-color: ${p =>
    p.hasErrors ? p.theme.colors.red100 : p.theme.tokens.background.primary};
  box-shadow: inset 0 0 0 1px
    ${p => (p.hasErrors ? p.theme.colors.red200 : 'transparent')};
  &:focus-within {
    z-index: 1;
  }
`;

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

export const TreeKeyTrunk = styled('div')<{spacerCount: number}>`
  grid-column: 1 / 2;
  display: grid;
  height: 100%;
  align-items: center;
  grid-template-columns: ${p => (p.spacerCount > 0 ? 'auto 1rem 1fr' : '1fr')};
`;

export const TreeValueTrunk = styled('div')`
  grid-column: 2 / 3;
  display: grid;
  height: 100%;
  align-items: center;
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

/**
 * Hidden element to allow browser searching for exact key name
 */
export const TreeSearchKey = styled('span')`
  font-size: 0;
  position: absolute;
`;

export const TreeValueDropdown = styled(DropdownMenu)`
  display: block;
  margin: 1px;
  height: 20px;
`;
