import React from "react";
import moment from "moment";

import Gravatar from "../../components/gravatar";
import GroupState from "../../mixins/groupState";
import {userDisplayName} from "../../utils/formatters";
import TooltipMixin from "../../mixins/tooltip";
import {logException} from "../../utils/logging";

var GroupSeenBy = React.createClass({
  mixins: [
    GroupState,
    TooltipMixin({
      html: true,
      selector: ".tip"
    })
  ],

  render() {
    var group = this.getGroup();
    var seenByNodes;

    try {
      seenByNodes = group.seenBy.map((user, userIdx) => {
        let title = userDisplayName(user) + '<br/>' + moment(user.lastSeen).format("LL");
        return (
          <li key={userIdx} className="tip" data-title={title}>
            <Gravatar size={52} email={user.email} />
          </li>
        );
      });
    } catch(ex) {
      logException(ex, group);
    }

    if (!seenByNodes) {
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

