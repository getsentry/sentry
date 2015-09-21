import $ from "jquery";
import React from "react";
import api from "../api";
import Gravatar from "../components/gravatar";
import GroupState from "../mixins/groupState";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import TimeSince from "../components/timeSince";
import utils from "../utils";

var GroupUserReports = React.createClass({
  // TODO(dcramer): only re-render on group/activity change
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [GroupState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      reportList: [],
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var queryParams = this.context.router.getCurrentQuery();
    var querystring = $.param(queryParams);

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.getGroup().id + '/user-reports/?' + querystring, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onPage(cursor) {
    var router = this.context.router;
    var queryParams = $.extend({}, router.getCurrentQuery(), {cursor: cursor});

    router.transitionTo('groupUserReports', this.context.router.getCurrentParams(), queryParams);
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var group = this.getGroup();
    var children = this.state.reportList.map((item, itemIdx) => {
      var body = utils.nl2br(utils.urlize(utils.escape(item.comments)));

      return (
        <li className="activity-note" key={itemIdx}>
          <Gravatar email={item.email} size={64} className="avatar" />
          <div className="activity-bubble">
            <TimeSince date={item.dateCreated} />
            <div className="activity-author">
              {item.name} <small>{item.email}</small>
              {item.resolution === 'awaiting_resolution' &&
                " Awaiting Resolution"
              }
            </div>
            <p dangerouslySetInnerHTML={{__html: body}} />
          </div>
        </li>
      );
    });

    if (children.length) {
      return (
        <div className="row">
          <div className="col-md-9">
            <div className="activity-container">
              <ul className="activity">
                {children}
              </ul>
            </div>
          </div>
          <div className="col-md-3">
            {group.userReportWaitingResolutionCount === 1 ?
              <p>There is <strong>one user</strong> who has asked to be notified
                when this issue is resolved.</p>
            :
              <p>There are <strong>{group.userReportWaitingResolutionCount || 'no'} users</strong>
                who have asked to be notified when this issue is resolved.</p>
            }
            {group.userReportWaitingResolutionCount &&
              <a className="btn btn-sm btn-primary">Message Subscribed Users</a>
            }
          </div>
        </div>
      );
    }
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>No user reports have been collected for this event.</p>
        <p><a href="">Learn how to integrate User Crash Reports</a></p>
      </div>
    );
  }
});

export default GroupUserReports;
