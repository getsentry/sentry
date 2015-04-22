/*** @jsx React.DOM */
var React = require("react");

var api = require("../../api");
var Gravatar = require("../../components/gravatar");
var GroupState = require("../../mixins/groupState");
var GroupStore = require("../../stores/groupStore");
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

var NoteInput = React.createClass({
  getInitialState() {
    return {
      loading: false,
      error: false,
      expanded: false,
      value: ''
    };
  },

  onSubmit(e) {
    e.preventDefault();

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.props.group.id + '/notes/', {
      method: 'POST',
      data: {
        text: this.state.value
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      },
      success: (data) => {
        this.setState({
          value: '',
          expanded: false,
          loading: false
        });
        GroupStore.addActivity(this.props.group.id, data);
      }
    });
  },

  onChange(e) {
    this.setState({value: e.target.value});
  },

  expand() {
    this.setState({expanded: true});
  },

  collapse() {
    if (this.state.value === '') {
      this.setState({expanded: false});
    }
  },

  render() {
    var classNames = 'activity-field';
    if (this.state.expanded) {
      classNames += ' expanded';
    }
    if (this.state.error) {
      classNames += ' error';
    }
    if (this.state.loading) {
      classNames += ' loading';
    }

    return (
      <form className={classNames} onSubmit={this.onSubmit}>
        <div className="activity-notes">
          <textarea placeholder="Add some details or an update to this event"
                    onChange={this.onChange}
                    onFocus={this.expand} onBlur={this.maybeCollapse}
                    value={this.state.value} />
          <div className="activity-actions">
            <button className="btn btn-default" type="submit">Leave note</button>
          </div>
        </div>
      </form>
    );
  }
});


var GroupActivity = React.createClass({
  mixins: [GroupState],

  render() {
    var group = this.getGroup();

    var children = group.activity.map((item, itemIdx) => {
      var avatar = (item.user ?
        <Gravatar email={item.user.email} size={64} className="avatar" /> :
        <div className="avatar sentry" />);

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
        <NoteInput group={group} />
        <ul className="activity">
          {children}
        </ul>
      </div>
    );
  }
});

module.exports = GroupActivity;
