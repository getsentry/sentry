/*** @jsx React.DOM */
var React = require("react");

var Gravatar = require("../../components/gravatar");
var GroupState = require("../../mixins/groupState");
var PropTypes = require("../../proptypes");
var TimeSince = require("../../components/timeSince");
var utils = require("../../utils");

var formatActivity = function(item) {
  var data = item.data;

  switch(item.type) {
    case "note":
      return "left a note";
    case "set_resolved":
      return "marked this event as resolved";
    case "set_unresolved":
      return "marked this event as unresolved";
    case "set_muted":
      return "marked this event as muted";
    case "set_public":
      return "made this event public";
    case "set_private":
      return "made this event private";
    case "set_regression":
      return "marked this event as a regression";
    case "create_issue":
      return `created an issue on ${data.provider} titled <a href="${data.location}">${data.title}</a>`;
    case "first_seen":
      return "first saw this event";
    case "assigned":
      return `assigned this event to ${data.user}`;
    case "unassigned":
      return "unassigned this event";
  }
};

var GroupActivity = React.createClass({
  mixins: [GroupState],

  render: function() {
    var group = this.getGroup();

    var children = group.activity.map((item, itemIdx) => {
      var avatar = (item.user ?
        <Gravatar email={item.user.email} size={64} className="avatar" /> :
        <img src="" className="avatar sentry" />);

      var authorName = (item.user ?
        item.user.name :
        'Sentry');

      var label = formatActivity(item);

      if (item.type === 'note') {
        return (
          <li className="activity-note" key={itemIdx}>
            {avatar}
            <div className="activity-bubble">
              <TimeSince date={item.dateCreated} />
              <div className="activity-author">{authorName}</div>
              <p>{ utils.nl2br(utils.urlize(utils.escape(item.data.text))) }</p>
            </div>
          </li>
        );
      } else {
        return (
          <li className="activity-item" key={itemIdx}>
            {avatar} <span className="activity-author">{authorName}</span> {label} <TimeSince date={item.dateCreated} />
          </li>
        );
      }
    });

    return (
      <div className="activity">
        <h6>Timeline</h6>
        <div className="activity-field">
          <div className="activity-notes">
            <textarea placeholder="Add some details or an update on this event" />
            <div className="activity-actions">
              <button className="btn btn-default">Leave note</button>
            </div>
          </div>
        </div>
        <ul className="activity">
          {children}
        </ul>
      </div>
    );
  }
});

module.exports = GroupActivity;
