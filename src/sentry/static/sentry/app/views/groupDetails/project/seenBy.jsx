import React from 'react';
import createReactClass from 'create-react-class';
import moment from 'moment';
import _ from 'lodash';
import styled from 'react-emotion';

import ConfigStore from 'app/stores/configStore';
import AvatarList from 'app/components/avatar/avatarList';
import GroupState from 'app/mixins/groupState';
import {userDisplayName} from 'app/utils/formatters';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

const GroupSeenBy = createReactClass({
  displayName: 'GroupSeenBy',

  mixins: [GroupState],

  render() {
    let activeUser = ConfigStore.get('user');
    let group = this.getGroup();

    // NOTE: Sometimes group.seenBy is undefined, even though the /groups/{id} API
    //       endpoint guarantees an array. We haven't figured out HOW GroupSeenBy
    //       is getting incomplete group records, but in the interim, we are just
    //       gracefully handing this case.
    //
    // See: https://github.com/getsentry/sentry/issues/2387

    let seenBy = group.seenBy || [];
    if (seenBy.length === 0) {
      return null;
    }

    // Note className="seen-by" is required for responsive design
    return (
      <SeenByWrapper className="seen-by">
        <AvatarList
          users={seenBy.filter(user => activeUser.id !== user.id)}
          avatarSize={28}
          maxVisibleAvatars={10}
          tooltipOptions={{html: true}}
          renderTooltip={user => `${_.escape(userDisplayName(user))} <br/>
            ${moment(user.lastSeen).format('LL')}`}
        />
        <IconWrapper>
          <Tooltip title={t("People who've viewed this issue")}>
            <EyeIcon className="icon-eye" />
          </Tooltip>
        </IconWrapper>
      </SeenByWrapper>
    );
  },
});

export default GroupSeenBy;

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
