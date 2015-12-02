import React from 'react';
import {History, Link} from 'react-router';
import ApiMixin from '../mixins/apiMixin';

import GroupState from '../mixins/groupState';

import DateTime from '../components/dateTime';
import Gravatar from '../components/gravatar';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';

const GroupEvents = React.createClass({
  mixins: [
    ApiMixin,
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

  componentDidUpdate(prevProps) {
    if (prevProps.params.groupId !== this.props.params.groupId ||
      prevProps.location.search !== this.props.location.search) {
      this.fetchData();
    }
  },

  fetchData() {
    let queryParams = this.props.location.query;

    this.setState({
      loading: true,
      error: false
    });

    this.api.request(`/issues/${this.getGroup().id}/events/`, {
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

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    let group = this.getGroup();
    let tagList = group.tags.filter((tag) => {
      return tag.key !== 'user';
    });

    let hasUser = false;
    for (let i = 0; i < this.state.eventList.length; i++) {
      if (this.state.eventList[i].user) {
        hasUser = true;
        break;
      }
    }

    let {orgId, projectId, groupId} = this.props.params;

    let children = this.state.eventList.map((event, eventIdx) => {
      let tagMap = {};
      event.tags.forEach((tag) => {
        tagMap[tag.key] = tag.value;
      });

      return (
        <tr key={eventIdx}>
          <td>
            <h5>
              <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/${event.id}/`}>
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
        <Pagination pageLinks={this.state.pageLinks}/>
      </div>
    );
  }
});

export default GroupEvents;
