import styled from '@emotion/styled';

import {inputStyles} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export const MentionEditor = styled('div')`
  ${inputStyles};
  height: auto;
  overflow: auto;
  resize: none;
  cursor: text;
  line-height: ${p => p.theme.font.lineHeight.comfortable};
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  & [data-mention] {
    font-weight: ${p => p.theme.font.weight.sans.medium};
  }

  &:empty::before {
    color: ${p => p.theme.tokens.content.secondary};
    content: attr(data-placeholder);
    pointer-events: none;
    white-space: pre-wrap;
  }
`;

export const CaretAnchor = styled('span')`
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  visibility: hidden;
  pointer-events: none;
`;

export function SuggestionStatus({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" justify="center" minHeight="64px" padding="md">
      <Text as="p" size="sm" variant="muted" align="center">
        {children}
      </Text>
    </Flex>
  );
}
