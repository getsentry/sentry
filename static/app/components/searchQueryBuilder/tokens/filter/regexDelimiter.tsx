import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {SpaceSize} from 'sentry/utils/theme';

interface RegexDelimiterProps {
  onMouseDown?: React.MouseEventHandler;
  paddingRight?: SpaceSize;
}

export function RegexDelimiter({onMouseDown, paddingRight}: RegexDelimiterProps) {
  return (
    <Container
      aria-hidden
      as="span"
      onMouseDown={onMouseDown}
      paddingRight={paddingRight}
    >
      <Text variant="muted">/</Text>
    </Container>
  );
}
