import {type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {MarkedText} from 'sentry/utils/marked/markedText';

const EMPTY_PLACEHOLDER = '\u2014'; // em dash

interface TextWidgetProps {
  text?: string;
}

export function TextWidgetVisualization({text}: TextWidgetProps) {
  if (!text) {
    return (
      <EmptyStateContainer>
        <Text variant="muted" size="2xl">
          {EMPTY_PLACEHOLDER}
        </Text>
      </EmptyStateContainer>
    );
  }

  return (
    <TextContainer>
      <MarkedText text={text} />
    </TextContainer>
  );
}

function EmptyStateContainer({children}: {children: ReactNode}) {
  return (
    <Flex align="center" justify="center" height="100%" minHeight="100px">
      {children}
    </Flex>
  );
}

function TextContainer({children}: {children: ReactNode}) {
  return (
    <StyledContainer padding="xl" overflowY="auto" height="100%" whiteSpace="pre-wrap">
      {children}
    </StyledContainer>
  );
}

const StyledContainer = styled(Container)`
  word-wrap: break-word;
  overflow-wrap: break-word;
`;
