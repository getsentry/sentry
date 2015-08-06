import $ from "jquery";
import React from "react";
import Router from "react-router";
import api from "../api";
import Gravatar from "../components/gravatar";
import GroupState from "../mixins/groupState";
import GroupStore from "../stores/groupStore";
import IndicatorStore from "../stores/indicatorStore";
import MemberListStore from "../stores/memberListStore";
import PropTypes from "../proptypes";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
import TimeSince from "../components/timeSince";
import utils from "../utils";

var formatActivity = function(item) {
  var data = item.data;

  switch(item.type) {
    case "note":
      return "left a comment";
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
      return <span>created an issue on {data.provider} titled <a href={data.location}>{data.title}</a></span>;
    case "first_seen":
      return "first saw this event";
    case "assigned":
      var assignee;
      if (data.assignee == item.user) {
        assignee = MemberListStore.getById(data.assignee);
        assignee = (assignee ? assignee.email : 'an unknown user');
      } else {
        assignee = 'themselves';
      }
      return `assigned this event to ${assignee}`;
    case "unassigned":
      return "unassigned this event";
  }
};

var NoteInput = React.createClass({
  mixins: [PureRenderMixin],

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

    var loadingIndicator = IndicatorStore.add('Posting comment..');

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
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onChange(e) {
    this.setState({value: e.target.value});
  },

  expand() {
    this.setState({expanded: true});
  },

  maybeCollapse() {
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
          <textarea placeholder="Add details or updates to this event"
                    onChange={this.onChange}
                    onFocus={this.expand} onBlur={this.maybeCollapse}
                    value={this.state.value} />
          <div className="activity-actions">
            <button className="btn btn-default" type="submit"
                    disabled={this.state.loading}>Leave comment</button>
          </div>
        </div>
      </form>
    );
  }
});


var GroupActivity = React.createClass({
  // TODO(dcramer): only re-render on group/activity change
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [GroupState],

  render() {
    var group = this.props.group;

    var children = group.activity.map((item, itemIdx) => {
      var avatar = (item.user ?
        <Gravatar email={item.user.email} size={64} className="avatar" /> :
        <div className="avatar sentry"><span className="icon-sentry-logo"></span></div>);

      var authorName = (item.user ?
        item.user.name :
        'Sentry');

      var label = formatActivity(item);

      if (item.type === 'note') {
        var noteBody = utils.nl2br(utils.urlize(utils.escape(item.data.text)));
        return (
          <li className="activity-note" key={itemIdx}>
            {avatar}
            <div className="activity-bubble">
              <TimeSince date={item.dateCreated} />
              <div className="activity-author">{authorName}</div>
              <p dangerouslySetInnerHTML={{__html: noteBody}} />
            </div>
          </li>
        );
      } else {
        return (
          <li className="activity-item" key={itemIdx}>
            {avatar}
            <TimeSince date={item.dateCreated} />
            <div className="activity-item-content">
              <span className="activity-author">{authorName}</span> {label}
            </div>
          </li>
        );
      }
    });

    return (
      <div className="row">
        <div className="col-md-9">
          <div className="activity-container">
            <NoteInput group={group} />
            <ul className="activity">
              {children}
            </ul>
          </div>
        </div>
      </div>
    );
  }
});

export default GroupActivity;

