import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {MarkedText} from 'sentry/utils/marked/markedText';

const EMPTY_PLACEHOLDER = '\u2014'; // em dash

interface TextWidgetProps {
  text?: string;
}

export function TextWidgetVisualization({text}: TextWidgetProps) {
  if (!text) {
    return (
      <Flex align="center" justify="center" height="100%" minHeight="100px">
        <Text variant="muted" size="2xl">
          {EMPTY_PLACEHOLDER}
        </Text>
      </Flex>
    );
  }

  return (
    <Fragment>
      <TextContainer>
        <MarkedText text={text} />
      </TextContainer>
    </Fragment>
  );
}

const TextContainer = styled('div')`
  padding: ${p => p.theme.space.xl};
  height: 100%;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;
