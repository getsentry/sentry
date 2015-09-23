import React from "react";
import {History, Link} from "react-router";
import api from "../api";

import GroupState from "../mixins/groupState";

import DateTime from "../components/dateTime";
import Gravatar from "../components/gravatar";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import Pagination from "../components/pagination";

var GroupEvents = React.createClass({
  mixins: [
    GroupState,
    History
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
    var queryParams = this.props.location.query;

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

  componentDidUpdate(prevProps) {
    if (prevProps.params.groupId !== this.props.params.groupId) {
      this.fetchData();
    }
  },

  onPage(cursor) {
    var queryParams = {...this.context.location.query, cursor: cursor};

    let {orgId, projectId, groupId} = this.props.params;
    this.history.pushState(
      null,
      `/${orgId}/${projectId}/group/${groupId}/events/`,
      queryParams
    );
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var group = this.getGroup();
    var tagList = group.tags.filter((tag) => {
      return tag.key !== 'user';
    });

    var hasUser = false;
    for (var i = 0; i < this.state.eventList.length; i++) {
      if (this.state.eventList[i].user) {
        hasUser = true;
        break;
      }
    }

    var {orgId, projectId, groupId} = this.props.params;

    var children = this.state.eventList.map((event, eventIdx) => {
      var tagMap = {};
      event.tags.forEach((tag) => {
        tagMap[tag.key] = tag.value;
      });

      return (
        <tr key={eventIdx}>
          <td>
            <h5>
              <Link to={`/${orgId}/${projectId}/group/${groupId}/events/${event.id}/`}>
                <DateTime date={event.dateCreated} />
              </Link>
              <small>{event.eventID}</small>
            </h5>
          </td>
          {tagList.map((tag) => {
            return (
              <td key={tag.key}>
                {tagMap[tag.key]}
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
              <tr>
                <th>ID</th>
                {tagList.map((tag) => {
                  return (
                    <th key={tag.key}>
                      {tag.name}
                    </th>
                  );
                })}
                {hasUser &&
                  <th>User</th>
                }
              </tr>
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
