//
// Styled components used by both ListBox and GridList
//

import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, type FlexProps} from '@sentry/scraps/layout';

export const ListWrap = styled('ul')`
  margin: 0;
  padding: ${p => p.theme.space.xs} 0;

  /* Add 1px to top padding if preceded by menu header, to account for the header's
  shadow border */
  [data-menu-has-header='true'] > div > &:first-of-type {
    padding-top: calc(${p => p.theme.space.xs} + 1px);
  }

  /* Add 1px to bottom padding if succeeded by menu footer, to account for the footer's
  shadow border */
  [data-menu-has-footer='true'] > div > &:last-of-type {
    padding-bottom: calc(${p => p.theme.space.xs} + 1px);
  }

  /* Remove top padding if preceded by search input, since search input already has
  vertical padding. Account for InputGroup wrapper div. */
  div:has(input) ~ &&:first-of-type,
  div:has(input) ~ div > &&:first-of-type {
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
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.secondary};
  text-transform: uppercase;
  white-space: nowrap;
  margin: ${p => p.theme.space.xs} ${p => p.theme.space.lg};
  padding-right: ${p => p.theme.space.md};
`;

export const ListSeparator = styled('div')`
  border-top: solid 1px ${p => p.theme.tokens.border.secondary};
  margin: ${p => p.theme.space.xs} ${p => p.theme.space.lg};

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
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.lg};

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
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.secondary};
  text-transform: uppercase;
  white-space: nowrap;

  margin: 0;
  padding-right: ${p => p.theme.space['3xl']};
`;

export const SectionToggleButton = styled(Button)<{visible: boolean}>`
  padding: 0 ${p => p.theme.space.xs};
  margin: 0 -${p => p.theme.space.xs} 0 ${p => p.theme.space.xl};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  transition: opacity 0.1s;

  &:focus-visible {
    opacity: 1;
    pointer-events: all;
  }

  ${p =>
    p.visible
      ? css`
          opacity: 1;
          pointer-events: all;
        `
      : css`
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
  border-top: solid 1px ${p => p.theme.tokens.border.secondary};
  margin: ${p => p.theme.space.xs} ${p => p.theme.space.lg};

  &:first-of-type {
    display: none;
  }
`;

export const SectionGroup = styled('ul')`
  margin: 0;
  padding: 0;
`;

export function LeadWrap(props: FlexProps) {
  return (
    <Flex
      justify="center"
      align="center"
      minWidth="1em"
      height="1.4em"
      pointerEvents="none"
      {...props}
    />
  );
}

export const EmptyMessage = styled('p')`
  text-align: center;
  color: ${p => p.theme.tokens.content.secondary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg} ${p => p.theme.space.lg};
  margin: 0;

  /* Message should only be displayed when _all_ preceding lists are empty */
  display: block;
  div:has(ul:not(:empty)) ~ &,
  ul:not(:empty) ~ & {
    display: none;
  }
`;

export const SizeLimitMessage = styled('li')`
  border-top: solid 1px ${p => p.theme.tokens.border.secondary};
  margin: ${p => p.theme.space.xs} ${p => p.theme.space.lg} ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md} 0;

  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  list-style-type: none;
  white-space: nowrap;
  text-align: center;
`;
