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
      <Flex align="start" justify="start" height="100%" minHeight="100px" padding="xl">
        <Text variant="muted" size="2xl">
          {EMPTY_PLACEHOLDER}
        </Text>
      </Flex>
    );
  }

  return (
    <Container padding="xl" overflowY="auto" height="100%" whiteSpace="normal">
      <Text wordBreak="break-word">
        <MarkedText text={text} />
      </Text>
    </Container>
  );
}
