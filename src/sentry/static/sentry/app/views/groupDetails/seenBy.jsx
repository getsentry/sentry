var React = require("react");

var Gravatar = require("../../components/gravatar");
var GroupState = require("../../mixins/groupState");

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

module.exports = GroupSeenBy;
