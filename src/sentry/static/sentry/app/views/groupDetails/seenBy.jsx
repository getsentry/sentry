import React from "react";
import moment from "moment";

import Gravatar from "../../components/gravatar";
import GroupState from "../../mixins/groupState";
import {userDisplayName} from "../../utils/formatters";

var GroupSeenBy = React.createClass({
  mixins: [GroupState],

  componentDidMount() {
    this.attachTooltips();
  },

  componentWillUnmount() {
    this.removeTooltips();
    $(this.getDOMNode()).unbind();
  },

  attachTooltips() {
    $(this.getDOMNode()).tooltip({
      html: true,
      selector: ".tip"
    });
  },

  removeTooltips() {
    $(this.getDOMNode()).tooltip("destroy");
  },

  render() {
    var group = this.getGroup();

    var seenByNodes = group.seenBy.map((user, userIdx) => {
      let title = userDisplayName(user) + '<br/>' + moment(user.lastSeen).format("LL");
      return (
        <li key={userIdx} className="tip" data-title={title}>
          <Gravatar size={52} email={user.email} />
        </li>
      );
    });

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

