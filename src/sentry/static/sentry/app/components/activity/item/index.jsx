import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

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
    date: PropTypes.string,

    /**
     * Used to render an avatar for the author. Currently can be a user, otherwise
     * defaults as a "system" avatar (i.e. sentry)
     *
     * `user` is required if `type` is "user"
     */
    author: PropTypes.shape({
      type: ActivityAvatar.propTypes.type,
      user: ActivityAvatar.propTypes.user,
    }).isRequired,

    avatarSize: PropTypes.number,

    // Hides date in header
    hideDate: PropTypes.bool,

    /**
     * Can be a react node or a render function. render function will not include default wrapper
     */
    header: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),

    /**
     * Can be a react node or a render function. render function will not include default wrapper
     */
    footer: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
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
      header,
      footer,
    } = this.props;

    const headerRenderFunc = typeof header === 'function';
    const footerRenderFunc = typeof footer === 'function';
    const childrenRenderFunc = typeof children === 'function';

    return (
      <ActivityItemWrapper data-test-id="activity-item" className={className}>
        {id && <a id={id} />}
        <StyledActivityAvatar type={author.type} user={author.user} size={avatarSize} />

        <ActivityBubble>
          {header && headerRenderFunc && header()}
          {header && !headerRenderFunc && (
            <ActivityHeader>
              <ActivityHeaderContent>{header}</ActivityHeaderContent>

              {!hideDate && date && <StyledTimeSince date={date} />}
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

export default ActivityItem;
