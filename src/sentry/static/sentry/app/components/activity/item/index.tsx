import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {AvatarUser} from 'app/types';
import DateTime from 'app/components/dateTime';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import textStyles from 'app/styles/text';
import {isRenderFunc} from 'app/utils/isRenderFunc';

import ActivityAvatar from './avatar';
import ActivityBubble from './bubble';

type ChildFunction = () => React.ReactNode;

type Props = {
  children?: React.ReactChild | ChildFunction;
  className?: string;
  /**
   * This is used to uniquely identify the activity item for use as an anchor
   */
  id?: string;

  /**
   * If supplied, will show the time since this date
   */
  date?: string | Date;

  /**
   * Used to render an avatar for the author. Currently can be a user, otherwise
   * defaults as a "system" avatar (i.e. sentry)
   *
   * `user` is required if `type` is "user"
   */
  author?: {
    type: 'user' | 'system';
    user?: AvatarUser;
  };

  // Size of the avatar.
  avatarSize?: number;

  // Hides date in header
  hideDate?: boolean;

  // Instead of showing a relative time/date, show the time
  showTime?: boolean;

  /**
   * Can be a react node or a render function. render function will not include default wrapper
   */
  header?: React.ReactNode | ChildFunction;

  /**
   * Can be a react node or a render function. render function will not include default wrapper
   */
  footer?: React.ReactNode | ChildFunction;

  bubbleProps?: React.ComponentProps<typeof ActivityBubble>;
};

function ActivityItem({
  author,
  avatarSize,
  bubbleProps,
  className,
  children,
  date,
  footer,
  id,
  header,
  hideDate = false,
  showTime = false,
}: Props) {
  const showDate = !hideDate && date;

  return (
    <ActivityItemWrapper data-test-id="activity-item" className={className}>
      {id && <a id={id} />}

      {author && (
        <StyledActivityAvatar type={author.type} user={author.user} size={avatarSize} />
      )}

      <ActivityBubble {...bubbleProps}>
        {header && isRenderFunc<ChildFunction>(header) && header()}
        {header && !isRenderFunc<ChildFunction>(header) && (
          <ActivityHeader>
            <ActivityHeaderContent>{header}</ActivityHeaderContent>

            {date && showDate && !showTime && <StyledTimeSince date={date} />}
            {date && showDate && showTime && <StyledDateTime timeOnly date={date} />}
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
      </ActivityBubble>
    </ActivityItemWrapper>
  );
}

ActivityItem.propTypes = {
  id: PropTypes.string,
  date: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  author: PropTypes.shape({
    type: ActivityAvatar.propTypes.type,
    user: ActivityAvatar.propTypes.user,
  }),
  avatarSize: PropTypes.number,
  hideDate: PropTypes.bool,
  showTime: PropTypes.bool,
  header: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  footer: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  bubbleProps: PropTypes.shape(ActivityBubble.propTypes as any),
};

const ActivityItemWrapper = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
`;

const HeaderAndFooter = styled('div')`
  padding: 6px ${space(2)};
`;

const ActivityHeader = styled(HeaderAndFooter)`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.borderLight};
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
  border-top: 1px solid ${p => p.theme.borderLight};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ActivityBody = styled('div')`
  padding: ${space(2)} ${space(2)};
  word-break: break-all;
  ${textStyles}
`;

const StyledActivityAvatar = styled(ActivityAvatar)`
  margin-right: ${space(1)};
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray500};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray500};
`;

export default ActivityItem;
