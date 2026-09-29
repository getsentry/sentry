import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

const AccentHighlight = styled(Container)`
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
`;

interface AccentPathSegmentProps {
  value: string;
  ellipsis?: boolean;
}

export function AccentPathSegment({value, ellipsis}: AccentPathSegmentProps) {
  return (
    <AccentHighlight
      display={ellipsis ? 'inline-block' : 'inline'}
      radius="xs"
      padding="0 xs"
      maxWidth={ellipsis ? '100%' : undefined}
    >
      {props => {
        const text = (
          <Text {...props} monospace variant="accent" ellipsis={ellipsis || undefined}>
            {value}
          </Text>
        );

        return ellipsis ? (
          <Tooltip title={value} showOnlyOnOverflow skipWrapper>
            {text}
          </Tooltip>
        ) : (
          text
        );
      }}
    </AccentHighlight>
  );
}
