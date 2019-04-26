import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';

import ActivityAvatar from './activityAvatar';
import ActivityBubble from './activityBubble';

class ActivityItem extends React.Component {
  static propTypes = {
    item: PropTypes.shape({
      id: PropTypes.string,
    }),
    date: PropTypes.object,
    author: PropTypes.shape({
      type: ActivityAvatar.propTypes.type,
      user: ActivityAvatar.propTypes.user,
    }),
    avatarSize: PropTypes.number,

    // Hides date in header
    hideDate: PropTypes.bool,

    header: PropTypes.node,
    footer: PropTypes.node,
    renderHeader: PropTypes.func,
    renderFooter: PropTypes.func,
  };

  render() {
    const {
      className,
      children,
      avatarSize,
      item,
      date,
      author,
      hideDate,
      renderHeader,
      renderFooter,
      header,
      footer,
    } = this.props;

    const customHeader = typeof renderHeader === 'function';
    const customFooter = typeof renderFooter === 'function';

    return (
      <ActivityItemWrapper className={className}>
        <a id={`activity-item-${item.id}`} />
        <StyledActivityAvatar type={author.type} user={author.user} size={avatarSize} />

        <ActivityBubble>
          {customHeader && renderHeader()}

          {!customHeader && !!header && (
            <ActivityHeader>
              <ActivityHeaderContent>{header}</ActivityHeaderContent>

              {!hideDate && <StyledTimeSince date={date} />}
            </ActivityHeader>
          )}

          {children && <ActivityBody>{children}</ActivityBody>}

          {customFooter && renderFooter()}
          {!customFooter && !!footer && <ActivityFooter>{footer}</ActivityFooter>}
        </ActivityBubble>
      </ActivityItemWrapper>
    );
  }
}

const ActivityItemWrapper = styled('div')`
  display: flex;
`;

const HeaderAndFooter = styled('div')`
  padding: ${space(0.5)} ${space(2)};
`;

const ActivityHeader = styled(HeaderAndFooter)`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  font-size: ${p => p.theme.fontSizeMedium};
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
  padding: ${space(1)} ${space(2)};
`;

const StyledActivityAvatar = styled(ActivityAvatar)`
  margin-right: ${space(1)};
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray2};
`;

export default ActivityItem;
