import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import TimeSince from 'sentry/components/timeSince';
import type {TagVariant} from 'sentry/utils/theme';

interface GroupStatusBadgeProps {
  children: string;
  dateAdded?: string;
  fontSize?: 'sm' | 'md';
  tooltip?: React.ReactNode;
  variant?: TagVariant;
}

/**
 * A styled tag shared between the inbox reason badge and the status badge.
 */
export function GroupStatusTag({
  variant = 'muted',
  fontSize = 'sm',
  tooltip,
  dateAdded,
  children,
}: GroupStatusBadgeProps) {
  return (
    <Tooltip title={tooltip} skipWrapper>
      <StyledTag variant={variant} fontSize={fontSize}>
        {children}
        {dateAdded && (
          <Fragment>
            <Separator variant={variant}>{' | '}</Separator>
            <TimeSince
              date={dateAdded}
              suffix=""
              unitStyle="extraShort"
              disabledAbsoluteTooltip
            />
          </Fragment>
        )}
      </StyledTag>
    </Tooltip>
  );
}

const StyledTag = styled(Tag, {
  shouldForwardProp: p => p !== 'fontSize',
})<{fontSize: 'sm' | 'md'}>`
  font-size: ${p => (p.fontSize === 'sm' ? p.theme.font.size.sm : p.theme.font.size.md)};
`;

const Separator = styled('span')<{variant: TagVariant}>`
  opacity: 80%;
`;
