import styled from '@emotion/styled';
import moment from 'moment-timezone';

import DateTime from 'sentry/components/dateTime';
import TimeSince from 'sentry/components/timeSince';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';
import {AvatarUser} from 'sentry/types';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';

import ActivityAvatar from './avatar';
import ActivityBubble, {ActivityBubbleProps} from './bubble';

export type ActivityAuthorType = 'user' | 'system';

type ChildFunction = () => React.ReactNode;

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
  // Size of the avatar.
  avatarSize?: number;
  bubbleProps?: ActivityBubbleProps;

  children?: React.ReactChild | ChildFunction;

  className?: string;

  /**
   * If supplied, will show the time that the activity started
   */
  date?: string | Date;

  /**
   * Can be a react node or a render function. render function will not include default wrapper
   */
  footer?: React.ReactNode | ChildFunction;

  /**
   * Can be a react node or a render function. render function will not include default wrapper
   */
  header?: React.ReactNode | ChildFunction;

  // Hides date in header
  hideDate?: boolean;

  /**
   * This is used to uniquely identify the activity item for use as an anchor
   */
  id?: string;

  /**
   * If supplied, will show the interval that the activity occurred in
   */
  interval?: number;

  // Instead of showing a relative time/date, show the time
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
  footer,
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
        {header && isRenderFunc<ChildFunction>(header) && header()}
        {header && !isRenderFunc<ChildFunction>(header) && (
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

        {children && isRenderFunc<ChildFunction>(children) && children()}
        {children && !isRenderFunc<ChildFunction>(children) && (
          <ActivityBody>{children}</ActivityBody>
        )}

        {footer && isRenderFunc<ChildFunction>(footer) && footer()}
        {footer && !isRenderFunc<ChildFunction>(footer) && (
          <ActivityFooter>{footer}</ActivityFooter>
        )}
      </StyledActivityBubble>
    </ActivityItemWrapper>
  );
}

const ActivityItemWrapper = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
`;

const HeaderAndFooter = styled('div')`
  padding: 6px ${space(2)};
`;

const ActivityHeader = styled(HeaderAndFooter)`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeMedium};

  &:last-child {
    border-bottom: none;
  }
`;

const ActivityHeaderContent = styled('div')`
  flex: 1;
`;

const ActivityFooter = styled(HeaderAndFooter)`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeMedium};
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

export default ActivityItem;
