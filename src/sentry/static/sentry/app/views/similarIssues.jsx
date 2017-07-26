import React, {PropTypes} from 'react';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import SimilarIssueItem from '../components/SimilarIssueItem';

const GroupEvents = React.createClass({
  propTypes: {
    query: PropTypes.string
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      issueList: [],
      loading: true,
      error: false,
      pageLinks: '',
      hidden: {},
      busy: {}
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.params.groupId !== this.props.params.groupId ||
      nextProps.location.search !== this.props.location.search
    ) {
      this.fetchData();
    }
  },

  getEndpoint() {
    let params = this.props.params;
    return `/issues/${params.groupId}/similar/`;
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
      error: err => {
        let error = err.responseJSON || true;
        error = error.detail || true;
        this.setState({
          error,
          loading: false
        });
      }
    });
  },

  handleMerge({issue}, e) {
    const {query, params} = this.props;

    if (params) {
      this.setState({
        ...this.state,
        busy: {
          ...this.state.busy,
          [issue.id]: true
        }
      });

      const {groupId, orgId, projectId} = params;
      if (groupId && orgId && projectId) {
        this.api.merge(
          {
            orgId,
            projectId,
            itemIds: [params.groupId, issue.id],
            query
          },
          {
            success: () => {
              this.setState({
                ...this.state,
                hidden: {
                  ...this.state.hidden,
                  [issue.id]: true
                }
              });
            },
            error: () => {
              this.setState({
                ...this.state,
                busy: {
                  ...this.state.busy,
                  [issue.id]: false
                }
              });
            }
          }
        );
      }
    }
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>
          {t('Found no similar issues.')}
        </p>
      </div>
    );
  },

  render() {
    let {orgId, projectId} = this.props.params;
    const isLoading = this.state.loading;
    const isError = this.state.error && !isLoading;
    const hasResults = this.state.issueList.length > 0 && !isError && !isLoading;
    const noResults = !hasResults && !isError && !isLoading;

    return (
      <div>
        {isLoading && <LoadingIndicator />}
        {isError && <LoadingError message={this.state.error} onRetry={this.fetchData} />}
        {hasResults &&
          <ul className="group-list">
            {this.state.issueList.map(([issue, score]) => (
              <SimilarIssueItem
                key={issue.id}
                visible={!this.state.hidden[issue.id]}
                busy={this.state.busy[issue.id]}
                orgId={orgId}
                projectId={projectId}
                event={issue}
                score={score}
                onMerge={this.handleMerge}
              />
            ))}
          </ul>}
        {hasResults && <Pagination pageLinks={this.state.pageLinks} />}
        {noResults && this.renderEmpty()}
      </div>
    );
  }
});

export default GroupEvents;
