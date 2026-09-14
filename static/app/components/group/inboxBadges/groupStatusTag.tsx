import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';

interface GroupStatusBadgeProps {
  children: string;
  fontSize?: 'sm' | 'md';
}

/**
 * A styled tag shared between the inbox reason badge and the status badge.
 */
export function GroupStatusTag({fontSize = 'sm', children}: GroupStatusBadgeProps) {
  return (
    <StyledTag variant="muted" fontSize={fontSize}>
      {children}
    </StyledTag>
  );
}

const StyledTag = styled(Tag, {
  shouldForwardProp: p => p !== 'fontSize',
})<{fontSize: 'sm' | 'md'}>`
  font-size: ${p => (p.fontSize === 'sm' ? p.theme.font.size.sm : p.theme.font.size.md)};
`;
