import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

export function ProfilingDetailsFrameTabs({children}: {children: ReactNode}) {
  return (
    <Flex
      as="ul"
      padding="0 md"
      margin="0"
      borderTop="primary"
      background="secondary"
      area="tabs"
      style={{listStyleType: 'none', userSelect: 'none'}}
    >
      {children}
    </Flex>
  );
}

export const ProfilingDetailsListItem = styled('li')<{
  margin?: 'none';
  size?: 'sm';
}>`
  height: 100%;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
  margin-right: ${p => (p.margin === 'none' ? 0 : p.theme.space.md)};

  button {
    height: 100%;
    border: none;
    border-top: 2px solid transparent;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    font-weight: ${p => p.theme.font.weight.sans.regular};
    margin: 0;

    color: ${p => p.theme.tokens.content.primary};

    display: inline-block;

    &::after {
      display: block;
      content: attr(data-title);
      font-weight: ${p => p.theme.font.weight.sans.medium};
      height: 1px;
      color: transparent;
      overflow: hidden;
      visibility: hidden;
      white-space: nowrap;
    }

    &:hover {
      color: ${p => p.theme.tokens.content.primary};
    }
  }

  &.active button {
    font-weight: ${p => p.theme.font.weight.sans.medium};
    border-bottom: 2px solid ${prop => prop.theme.tokens.border.accent};
  }
`;
