import styled from '@emotion/styled';
import moment from 'moment-timezone';

import DateTime from 'sentry/components/dateTime';
import TimeSince from 'sentry/components/timeSince';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';
import {AvatarUser} from 'sentry/types';

import {ActivityAvatar} from './avatar';
import {ActivityBubble, ActivityBubbleProps} from './bubble';

export type ActivityAuthorType = 'user' | 'system';

interface ActivityItemProps {
  /**
   * Used to render an avatar for the author. Currently can be a user, otherwise
   * defaults as a "system" avatar (i.e. sentry)
   *
   * `user` is required if `type` is "user"
   */
  author?: {
    type: ActivityAuthorType;
    user?: AvatarUser;
  };
  avatarSize?: number;
  bubbleProps?: ActivityBubbleProps;
  children?: React.ReactNode;

  className?: string;
  /**
   * If supplied, will show the time that the activity started
   */
  date?: string | Date;
  /**
   * Can be a react node or a render function. render function will not include default wrapper
   */
  header?: React.ReactNode;
  /**
   * Do not show the date in the header
   */
  hideDate?: boolean;
  /**
   * This is used to uniquely identify the activity item for use as an anchor
   */
  id?: string;
  /**
   * If supplied, will show the interval that the activity occurred in
   */
  interval?: number;
  /**
   * Removes padding on the activtiy body
   */
  noPadding?: boolean;
  /**
   * Show exact time instead of relative date/time.
   */
  showTime?: boolean;
}

function ActivityItem({
  author,
  avatarSize,
  bubbleProps,
  className,
  children,
  date,
  interval,
  noPadding,
  id,
  header,
  hideDate = false,
  showTime = false,
}: ActivityItemProps) {
  const showDate = !hideDate && date && !interval;
  const showRange = !hideDate && date && interval;
  const dateEnded = showRange
    ? moment(date).add(interval, 'minutes').utc().format()
    : undefined;
  const timeOnly = Boolean(
    date && dateEnded && moment(date).date() === moment(dateEnded).date()
  );

  return (
    <ActivityItemWrapper data-test-id="activity-item" className={className}>
      {id && <a id={id} />}

      {author && (
        <StyledActivityAvatar type={author.type} user={author.user} size={avatarSize} />
      )}

      <StyledActivityBubble {...bubbleProps}>
        {header && (
          <ActivityHeader>
            <ActivityHeaderContent>{header}</ActivityHeaderContent>
            {date && showDate && !showTime && <StyledTimeSince date={date} />}
            {date && showDate && showTime && <StyledDateTime timeOnly date={date} />}

            {showRange && (
              <StyledDateTimeWindow>
                <StyledDateTime timeOnly={timeOnly} date={date} />
                {' — '}
                <StyledDateTime timeOnly={timeOnly} date={dateEnded} />
              </StyledDateTimeWindow>
            )}
          </ActivityHeader>
        )}

        {children && (noPadding ? children : <ActivityBody>{children}</ActivityBody>)}
      </StyledActivityBubble>
    </ActivityItemWrapper>
  );
}

const ActivityItemWrapper = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
`;

const ActivityHeader = styled('div')`
  display: flex;
  align-items: center;
  padding: 6px ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeMedium};

  &:last-child {
    border-bottom: none;
  }
`;

const ActivityHeaderContent = styled('div')`
  flex: 1;
`;

const ActivityBody = styled('div')`
  padding: ${space(2)} ${space(2)};
  ${textStyles}
`;

const StyledActivityAvatar = styled(ActivityAvatar)`
  margin-right: ${space(1)};
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray300};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray300};
`;

const StyledDateTimeWindow = styled('div')`
  color: ${p => p.theme.gray300};
`;

const StyledActivityBubble = styled(ActivityBubble)`
  width: 75%;
  overflow-wrap: break-word;
`;

export {ActivityItem};
