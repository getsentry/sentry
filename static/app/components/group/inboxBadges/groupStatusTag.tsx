import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Tooltip} from 'sentry/components/core/tooltip';
import TimeSince from 'sentry/components/timeSince';
import type {TagVariant} from 'sentry/utils/theme';

interface GroupStatusBadgeProps {
  children: string;
  dateAdded?: string;
  fontSize?: 'sm' | 'md';
  tooltip?: React.ReactNode;
  type?: TagVariant;
}

/**
 * A styled tag shared between the inbox reason badge and the status badge.
 */
export function GroupStatusTag({
  type = 'default',
  fontSize = 'sm',
  tooltip,
  dateAdded,
  children,
}: GroupStatusBadgeProps) {
  return (
    <Tooltip title={tooltip} skipWrapper>
      <StyledTag type={type} fontSize={fontSize}>
        {children}
        {dateAdded && (
          <Fragment>
            <Separator type={type}>{' | '}</Separator>
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
  font-size: ${p => (p.fontSize === 'sm' ? p.theme.fontSize.sm : p.theme.fontSize.md)};
`;

const Separator = styled('span')<{type: TagVariant}>`
  color: ${p => p.theme.tag[p.type].border};
  opacity: 80%;
`;
