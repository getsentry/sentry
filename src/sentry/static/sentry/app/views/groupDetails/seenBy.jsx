import React from "react";
import Gravatar from "../../components/gravatar";
import GroupState from "../../mixins/groupState";

var GroupSeenBy = React.createClass({
  mixins: [GroupState],

  render() {
    var group = this.getGroup();

    var seenByNodes = group.seenBy.map((user, userIdx) => {
      return (
        <li key={userIdx}>
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

