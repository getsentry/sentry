import React from 'react';
import moment from 'moment';
import _ from 'underscore';

import ConfigStore from '../../stores/configStore';
import Avatar from '../../components/avatar';
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

    let seenByNodes = seenBy.filter((user, userIdx) => {
      return activeUser.id !== user.id;
    }).map((user, userIdx) => {
      let title = _.escape(userDisplayName(user)) + '<br/>' + _.escape(moment(user.lastSeen).format('LL'));
      return (
        <li key={userIdx} className="tip" data-title={title}>
          <Avatar size={52} user={user} />
        </li>
      );
    });

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

