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
      let title = userDisplayName(user) + '<br/>' + moment(user.lastSeen).format('LL');
      return (
        <li key={userIdx} className="tip" data-title={title}>
          <Gravatar size={52} email={user.email} />
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

