import React from "react";
import Router from "react-router";
import api from "../api";

import GroupState from "../mixins/groupState";
import RouteMixin from "../mixins/routeMixin";

import DateTime from "../components/dateTime";
import Gravatar from "../components/gravatar";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import Pagination from "../components/pagination";

var GroupEvents = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    GroupState,
    RouteMixin
  ],

  getInitialState() {
    return {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var queryParams = this.context.router.getCurrentQuery();

    this.setState({
      loading: true,
      error: false
    });

    api.request(`/groups/${this.getGroup().id}/events/`, {
      method: 'GET',
      data: queryParams,
      success: (data, _, jqXHR) => {
        this.setState({
          eventList: data,
          error: false,
          loading: false,
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

  routeDidChange() {
    this.fetchData();
  },

  onPage(cursor) {
    var router = this.context.router;
    var queryParams = {...router.getCurrentQuery(), cursor: cursor};

    router.transitionTo('groupEvents', this.context.router.getCurrentParams(), queryParams);
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var group = this.getGroup();
    var tagList = [];
    for (var key in group.tags) {
      tagList.push([group.tags[key].name, key]);
    }
    tagList.sort();

    var hasUser = false;
    for (var i = 0; i < this.state.eventList.length; i++) {
      if (this.state.eventList[i].user) {
        hasUser = true;
        break;
      }
    }

    var children = this.state.eventList.map((event, eventIdx) => {
      var linkParams = {
        orgId: this.getOrganization().slug,
        projectId: this.getProject().slug,
        groupId: this.getGroup().id,
        eventId: event.id
      };

      return (
        <tr key={eventIdx}>
          <td>
            <h5>
              <Router.Link to="groupEventDetails"
                           params={linkParams}>
                <DateTime date={event.dateCreated} />
              </Router.Link>
              <small>{event.eventID}</small>
            </h5>
          </td>
          {tagList.map((tag, tagIdx) => {
            return (
              <td key={tagIdx}>
                {event.tags[tag[1]]}
              </td>
            );
          })}
          {hasUser &&
            <td className="event-user table-user-info">
              {event.user ?
                <div>
                  <Gravatar email={event.user.email} size={64} className="avatar" />
                  {event.user.email}
                </div>
              :
                <span>&mdash;</span>
              }
            </td>
          }
        </tr>
      );
    });

    return (
      <div>
        <div className="event-list">
          <table className="table">
            <thead>
              <th>ID</th>
              {tagList.map((tag, tagIdx) => {
                return (
                  <th key={tagIdx}>
                    {tag[0]}
                  </th>
                );
              })}
              {hasUser &&
                <th>User</th>
              }
            </thead>
            <tbody>
              {children}
            </tbody>
          </table>
        </div>
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

export default GroupEvents;
