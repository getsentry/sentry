import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import type {SpaceSize} from 'sentry/utils/theme';

interface RegexDelimiterProps {
  onMouseDown?: React.MouseEventHandler;
  paddingRight?: SpaceSize;
}

export function RegexDelimiter({onMouseDown, paddingRight}: RegexDelimiterProps) {
  return (
    <DelimiterText
      aria-hidden
      onMouseDown={onMouseDown}
      paddingRight={paddingRight}
      variant="muted"
    >
      /
    </DelimiterText>
  );
}

const DelimiterText = styled(Text)<{paddingRight?: SpaceSize}>`
  padding-right: ${p => (p.paddingRight ? p.theme.space[p.paddingRight] : undefined)};
`;
