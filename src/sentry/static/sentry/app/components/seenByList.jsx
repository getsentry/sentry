import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import moment from 'moment';
import styled from 'react-emotion';

import {t} from 'app/locale';
import {userDisplayName} from 'app/utils/formatters';
import AvatarList from 'app/components/avatar/avatarList';
import ConfigStore from 'app/stores/configStore';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';

export default class SeenByList extends React.Component {
  static propTypes = {
    // Avatar size
    avatarSize: PropTypes.number,

    // List of *all* users that have seen something
    seenBy: PropTypes.arrayOf(SentryTypes.User).isRequired,

    // Tooltip message for the "Seen By" icon
    iconTooltip: PropTypes.string,

    iconPosition: PropTypes.oneOf(['left', 'right']),

    // Max avatars to display
    maxVisibleAvatars: PropTypes.number,
  };

  static defaultProps = {
    avatarSize: 28,
    iconTooltip: t('People who have viewed this'),
    iconPosition: 'left',
    maxVisibleAvatars: 10,
    seenBy: [],
  };

  render() {
    const activeUser = ConfigStore.get('user');
    const {
      className,
      avatarSize,
      maxVisibleAvatars,
      seenBy,
      iconPosition,
      iconTooltip,
    } = this.props;

    const displayUsers = seenBy.filter(user => activeUser.id !== user.id);
    if (displayUsers.length === 0) {
      return null;
    }

    // Note className="seen-by" is required for responsive design
    return (
      <SeenByWrapper
        iconPosition={iconPosition}
        className={classNames('seen-by', className)}
      >
        <AvatarList
          users={displayUsers}
          avatarSize={avatarSize}
          maxVisibleAvatars={maxVisibleAvatars}
          renderTooltip={user => (
            <React.Fragment>
              {userDisplayName(user)}
              <br />
              {moment(user.lastSeen).format('LL')}
            </React.Fragment>
          )}
        />
        <IconWrapper iconPosition={iconPosition}>
          <Tooltip title={iconTooltip}>
            <EyeIcon className="icon-eye" />
          </Tooltip>
        </IconWrapper>
      </SeenByWrapper>
    );
  }
}

const SeenByWrapper = styled('div')`
  display: flex;
  margin-top: 15px;
  float: right;
  ${p => (p.iconPosition === 'left' ? 'flex-direction: row-reverse' : '')};
`;

const IconWrapper = styled('div')`
  background-color: transparent;
  color: #493e54;
  height: 28px;
  width: 28px;
  line-height: 26px;
  text-align: center;
  ${p => (p.iconPosition === 'left' ? 'margin-right: 10px' : '')};
`;

const EyeIcon = styled('span')`
  opacity: 0.4;
  position: relative;
  top: 2px;
`;
