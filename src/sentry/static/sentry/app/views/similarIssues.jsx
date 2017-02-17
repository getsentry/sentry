import React from 'react';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import DateTime from '../components/dateTime';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import {t} from '../locale';

const GroupEvents = React.createClass({
  mixins: [
    ApiMixin,
    GroupState
  ],

  getInitialState() {
    return {
      issueList: [],
      loading: true,
      error: false,
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId ||
        nextProps.location.search !== this.props.location.search) {
      this.fetchData();
    }
  },

  getEndpoint() {
    let params = this.props.params;
    // let queryParams = {
    //   ...this.props.location.query,
    //   limit: 50,
    //   query: this.state.query
    // };

    return `/issues/${params.groupId}/similar/`;//`?${jQuery.param(queryParams)}`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      method: 'GET',
      data: undefined,
      success: (data, _, jqXHR) => {
        this.setState({
          issueList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (err) => {
        let error = err.responseJSON || true;
        error = error.detail || true;
        this.setState({
          error,
          loading: false
        });
      }
    });
  },

  // getEventTitle(event) {
  //   switch (event.type) {
  //     case 'error':
  //       if (event.metadata.type && event.metadata.value)
  //         return `${event.metadata.type}: ${event.metadata.value}`;
  //       return event.metadata.type || event.metadata.value || event.metadata.title;
  //     case 'csp':
  //       return event.metadata.message;
  //     case 'default':
  //       return event.metadata.title;
  //     default:
  //       return event.message.split('\n')[0];
  //   }
  // },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('Found no similar issues.')}</p>
      </div>
    );
  },

  renderResults() {
    let tagList = ['count', 'culprit'];
    let {orgId, projectId, groupId} = this.props.params;

    let children = this.state.issueList.map(([issue, score]) => {
      console.log(issue);
      let tagMap = tagList.map( (key) => {
        return {key, value:issue[key]};
      });
      return (
        <tr key={issue.id}>
          <td>
            <h5>
              <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/${issue.id}/`}>
                <DateTime date={issue.firstSeen} />
              </Link>
              <small>{(issue.title || '').substr(0, 100)}</small>
            </h5>
          </td>
          {tagMap.map((tag) => {
            return (
              <td key={tag.key}>
                {tag.value}
              </td>
            );
          })}
          <td key="button">
            <button>merge</button>
          </td>
        </tr>
      );
    });

    return (
      <div>
        <div className="event-list">
          <table className="table">
            <thead>
              <tr>
                <th>{t('ID')}</th>
                {tagList.map((tag) => {
                  return (
                    <th key={tag}>
                      {tag}
                    </th>
                  );
                })}
                <th key="button">
                  Merge
                </th>
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
  },

  renderBody() {
    let body;

    if (this.state.loading)
      body = <LoadingIndicator />;
    else if (this.state.error)
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    else if (this.state.issueList.length > 0)
      body = this.renderResults();
    else
      body = this.renderEmpty();

    return body;
  },

  render() {
    return (
      <div>
        {this.renderBody()}
      </div>
    );
  }
});

export default GroupEvents;
