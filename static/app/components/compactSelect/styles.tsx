//
// Styled components used by both ListBox and GridList
//

import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {space} from 'sentry/styles/space';

export const ListWrap = styled('ul')`
  margin: 0;
  padding: ${space(0.5)} 0;

  /* Add 1px to top padding if preceded by menu header, to account for the header's
  shadow border */
  [data-menu-has-header='true'] > div > &:first-of-type {
    padding-top: calc(${space(0.5)} + 1px);
  }

  /* Add 1px to bottom padding if succeeded by menu footer, to account for the footer's
  shadow border */
  [data-menu-has-footer='true'] > div > &:last-of-type {
    padding-bottom: calc(${space(0.5)} + 1px);
  }

  /* Remove top padding if preceded by search input, since search input already has
  vertical padding */
  input ~ &&:first-of-type,
  input ~ div > &&:first-of-type {
    padding-top: 0;
  }

  &:empty {
    padding: 0;
  }

  /* Should scroll if it's in a non-composite select */
  :only-of-type {
    min-height: 0;
    overflow: auto;
  }

  :focus-visible {
    outline: none;
  }
`;

export const ListLabel = styled('p')`
  display: inline-block;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  white-space: nowrap;
  margin: ${space(0.5)} ${space(1.5)};
  padding-right: ${space(1)};
`;

export const ListSeparator = styled('div')`
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};

  :first-child {
    display: none;
  }

  ul:empty + & {
    display: none;
  }
`;

export const SectionWrap = styled('li')`
  list-style-type: none;
`;

export const SectionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: content-box;
  height: 1.5em;
  padding: ${space(0.25)} ${space(1.5)};

  /* Remove top padding if this is the first section in a headerless menu (selected
  with li:nth-of-type(2) because the first list item is a hidden separator) */
  [data-menu-has-header='false']
    ul:first-of-type
    li[role='presentation']:nth-of-type(2)
    > & {
    padding-top: 0;
  }
`;

export const SectionTitle = styled('p')`
  display: inline-block;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  white-space: nowrap;

  margin: 0;
  padding-right: ${space(4)};
`;

export const SectionToggleButton = styled(Button)<{visible: boolean}>`
  padding: 0 ${space(0.5)};
  margin: 0 -${space(0.5)} 0 ${space(2)};
  font-weight: 400;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  transition: opacity 0.1s;

  &.focus-visible {
    opacity: 1;
    pointer-events: all;
  }

  ${p =>
    p.visible
      ? `
    opacity: 1;
    pointer-events: all;
  `
      : `
    opacity: 0;
    pointer-events: none;
  `}

  li[role="rowgroup"]:hover &,
  li[role="presentation"]:hover & {
    opacity: 1;
    pointer-events: all;
  }
`;

export const SectionSeparator = styled('li')`
  list-style-type: none;
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};

  &:first-of-type {
    display: none;
  }
`;

export const SectionGroup = styled('ul')`
  margin: 0;
  padding: 0;
`;

export const CheckWrap = styled('div')<{isSelected: boolean; multiple: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 1em;
  height: 1.4em;
  padding-bottom: 1px;
  pointer-events: none;
`;

export const EmptyMessage = styled('p')`
  text-align: center;
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(1.5)} ${space(1.5)};
  margin: 0;

  /* Message should only be displayed when _all_ preceding lists are empty */
  display: block;
  ul:not(:empty) ~ & {
    display: none;
  }
`;

export const SizeLimitMessage = styled('li')`
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)} ${space(0.5)};
  padding: ${space(0.75)} ${space(1)} 0;

  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  list-style-type: none;
  white-space: nowrap;
  text-align: center;
`;
