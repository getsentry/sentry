import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';

interface GroupStatusBadgeProps {
  children: string;
  dateAdded?: string;
  fontSize?: 'sm' | 'md';
  tooltip?: React.ReactNode;
  type?: TagProps['type'];
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
  font-size: ${p =>
    p.fontSize === 'sm' ? p.theme.fontSizeSmall : p.theme.fontSizeMedium};
`;

const Separator = styled('span')<{type: keyof Theme['tag']}>`
  color: ${p => p.theme.tag[p.type].border};
  opacity: 80%;
`;
