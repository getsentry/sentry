import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {MarkedText} from 'sentry/utils/marked/markedText';

const EMPTY_PLACEHOLDER = '\u2014'; // em dash

interface TextWidgetProps {
  description?: string;
}

export function TextWidgetVisualization({description}: TextWidgetProps) {
  if (!description) {
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
        <MarkedText text={description} />
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
