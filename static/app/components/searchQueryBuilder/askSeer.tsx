import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const ASK_SEER_ITEM_KEY = 'ask_seer';

export const AskSeerPane = styled('div')`
  grid-area: seer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  background-color: ${p => p.theme.purple100};
  width: 100%;
`;

export const AskSeerListItem = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${space(1)} ${space(1.5)};
  background: transparent;
  border-radius: 0;
  background-color: none;
  box-shadow: none;
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-align: left;
  justify-content: flex-start;
  gap: ${space(1)};
  list-style: none;
  margin: 0;

  &:hover,
  &:focus {
    cursor: pointer;
  }

  &[aria-selected='true'] {
    background: ${p => p.theme.purple100};
    color: ${p => p.theme.purple400};
  }
`;

export const AskSeerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
