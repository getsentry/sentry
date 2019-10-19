import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import DateTime from 'app/components/dateTime';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import textStyles from 'app/styles/text';

import ActivityAvatar from './avatar';
import ActivityBubble from './bubble';

class ActivityItem extends React.Component {
  static propTypes = {
    /**
     * This is used to uniquely identify the activity item for use as an anchor
     */
    id: PropTypes.string,

    /**
     * If supplied, will show the time since this date
     */
    date: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),

    /**
     * Used to render an avatar for the author. Currently can be a user, otherwise
     * defaults as a "system" avatar (i.e. sentry)
     *
     * `user` is required if `type` is "user"
     */
    author: PropTypes.shape({
      type: ActivityAvatar.propTypes.type,
      user: ActivityAvatar.propTypes.user,
    }),

    avatarSize: PropTypes.number,

    // Hides date in header
    hideDate: PropTypes.bool,

    // Instead of showing a relative time/date, show the time
    showTime: PropTypes.bool,

    /**
     * Can be a react node or a render function. render function will not include default wrapper
     */
    header: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),

    /**
     * Can be a react node or a render function. render function will not include default wrapper
     */
    footer: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),

    bubbleProps: PropTypes.shape(ActivityBubble.propTypes),
  };

  render() {
    const {
      className,
      children,
      avatarSize,
      id,
      date,
      author,
      hideDate,
      showTime,
      header,
      footer,
      bubbleProps,
    } = this.props;

    const headerRenderFunc = typeof header === 'function';
    const footerRenderFunc = typeof footer === 'function';
    const childrenRenderFunc = typeof children === 'function';
    const showDate = !hideDate && date;

    return (
      <ActivityItemWrapper data-test-id="activity-item" className={className}>
        {id && <a id={id} />}

        <StyledActivityAvatar
          type={author && author.type}
          user={author && author.user}
          size={avatarSize}
        />

        <ActivityBubble {...bubbleProps}>
          {header && headerRenderFunc && header()}
          {header && !headerRenderFunc && (
            <ActivityHeader>
              <ActivityHeaderContent>{header}</ActivityHeaderContent>

              {showDate && !showTime && <StyledTimeSince date={date} />}
              {showDate && showTime && <StyledDateTime timeOnly date={date} />}
            </ActivityHeader>
          )}

          {children && childrenRenderFunc && children()}
          {children && !childrenRenderFunc && <ActivityBody>{children}</ActivityBody>}

          {footer && footerRenderFunc && footer()}
          {footer && !footerRenderFunc && <ActivityFooter>{footer}</ActivityFooter>}
        </ActivityBubble>
      </ActivityItemWrapper>
    );
  }
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
  ${textStyles}
`;

const StyledActivityAvatar = styled(ActivityAvatar)`
  margin-right: ${space(1)};
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray2};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
`;

export default ActivityItem;
