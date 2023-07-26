import {Fragment} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/tag';
import TimeSince from 'sentry/components/timeSince';

interface GroupStatusBadgeProps {
  children: string;
  dateAdded?: string;
  fontSize?: 'sm' | 'md';
  tooltip?: React.ReactNode;
  type?: keyof Theme['tag'];
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
    <StyledTag type={type} tooltipText={tooltip} fontSize={fontSize}>
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
