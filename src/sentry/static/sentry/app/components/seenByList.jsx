import PropTypes from 'prop-types';
import React from 'react';
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

    // Max avatars to display
    maxVisibleAvatars: PropTypes.number,
  };

  static defaultProps = {
    avatarSize: 28,
    iconTooltip: t('People who have viewed this'),
    maxVisibleAvatars: 10,
    seenBy: [],
  };

  render() {
    const activeUser = ConfigStore.get('user');
    const {avatarSize, maxVisibleAvatars, seenBy, iconTooltip} = this.props;

    // NOTE: Sometimes group.seenBy is undefined, even though the /groups/{id} API
    //       endpoint guarantees an array. We haven't figured out HOW GroupSeenBy
    //       is getting incomplete group records, but in the interim, we are just
    //       gracefully handing this case.
    //
    // See: https://github.com/getsentry/sentry/issues/2387

    if (seenBy.length === 0) {
      return null;
    }

    // Note className="seen-by" is required for responsive design
    return (
      <SeenByWrapper className="seen-by">
        <AvatarList
          users={seenBy.filter(user => activeUser.id !== user.id)}
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
        <IconWrapper>
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
  flex-direction: row-reverse;
  margin-top: 15px;
  float: right;
`;

const IconWrapper = styled('div')`
  background-color: transparent;
  color: #493e54;
  height: 28px;
  width: 28px;
  line-height: 26px;
  text-align: center;
  margin-right: 10px;
`;

const EyeIcon = styled('span')`
  opacity: 0.4;
  position: relative;
  top: 2px;
`;
