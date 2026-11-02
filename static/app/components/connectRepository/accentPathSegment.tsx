import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

const AccentHighlight = styled(Container)`
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
  color: ${p => p.theme.tokens.content.accent};
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
      {props =>
        ellipsis ? (
          <InfoText
            {...props}
            title={value}
            mode="overflowOnly"
            monospace
            variant="inherit"
          >
            {value}
          </InfoText>
        ) : (
          <Text {...props} monospace variant="inherit">
            {value}
          </Text>
        )
      }
    </AccentHighlight>
  );
}
