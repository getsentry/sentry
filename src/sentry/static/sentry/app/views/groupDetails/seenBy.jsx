import React from 'react';
import moment from 'moment';

import ConfigStore from '../../stores/configStore';
import Gravatar from '../../components/gravatar';
import GroupState from '../../mixins/groupState';
import {userDisplayName} from '../../utils/formatters';
import TooltipMixin from '../../mixins/tooltip';

const GroupSeenBy = React.createClass({
  mixins: [
    GroupState,
    TooltipMixin({
      html: true,
      selector: '.tip'
    })
  ],

  render() {
    let activeUser = ConfigStore.get('user');
    let group = this.getGroup();

    let seenByNodes = group.seenBy.filter((user, userIdx) => {
      return activeUser.id !== user.id;
    }).map((user, userIdx) => {
      let title = userDisplayName(user) + '<br/>' + moment(user.lastSeen).format('LL');
      return (
        <li key={userIdx} className="tip" data-title={title}>
          <Gravatar size={52} email={user.email} />
        </li>
      );
    });

    if (seenByNodes.length === 0) {
      return null;
    }

    return (
      <div className="seen-by">
        <ul>
          <li><span className="icon-eye" /></li>
          {seenByNodes}
        </ul>
      </div>
    );
  }
});

export default GroupSeenBy;

