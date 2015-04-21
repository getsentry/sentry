/*** @jsx React.DOM */
var React = require("react");

var Gravatar = require("../../components/gravatar");
var GroupState = require("../../mixins/groupState");
var PropTypes = require("../../proptypes");
var TimeSince = require("../../components/timeSince");
var utils = require("../../utils");


var ACTIVITY_ACTION_STRINGS = {
    note: "left a note",
    set_resolved: "marked this event as resolved",
    set_unresolved: "marked this event as unresolved",
    set_muted: "marked this event as muted",
    set_public: "made this event public",
    set_private: "made this event private",
    set_regression: "marked this event as a regression",
    create_issue: "created an issue on {provider:s} titled <a href=\"{location:s}\">{title:s}</a>",
    first_seen: "first saw this event",
    assigned: "assigned this event to {user:s}",
    unassigned: "unassigned this event"
};

var GroupActivity = React.createClass({
  mixins: [GroupState],

  render: function() {
    var group = this.getGroup();

    var children = group.activity.map((item, itemIdx) => {
      var avatar = (item.user ?
        <Gravatar email={item.user.email} size={16} className="avatar" /> :
        <img src="" className="avatar" />);

      var authorName = (item.user ?
        item.user.name :
        'Sentry');

      var label = ACTIVITY_ACTION_STRINGS[item.type];

      return (
        <li className="activity-item" key={itemIdx}>
          {avatar}
          <TimeSince date={item.dateCreated} />
          <strong>{authorName}</strong> {label}
          {item.type === 'note' &&
            utils.nl2br(utils.urlize(utils.escape(item.data.text)))
          }
        </li>
      );
    });

    return (
      <div className="activity">
        <h6>Timeline</h6>
        <div className="activity-field">
          <textarea className="form-control" placeholder="Add some details or an update on this event" />
        </div>
        <ul className="activity">
          {children}
        </ul>
      </div>
    );
  }
});

module.exports = GroupActivity;
