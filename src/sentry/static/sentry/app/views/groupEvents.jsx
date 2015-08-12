import $ from "jquery";
import React from "react";
import Router from "react-router";
import api from "../api";
import DateTime from "../components/dateTime";
import GroupState from "../mixins/groupState";
import Gravatar from "../components/gravatar";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import Pagination from "../components/pagination";
import PropTypes from "../proptypes";

var GroupEvents = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [GroupState],

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
    var querystring = $.param(queryParams);

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.getGroup().id + '/events/?' + querystring, {
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

  onPage(cursor) {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();
    queryParams.cursor = cursor;

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
        </tr>
      );
    });

    return (
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
            {event.user &&
              <th>User</th>
            }
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>

        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

export default GroupEvents;

