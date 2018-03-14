import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import SentryTypes from '../proptypes';
import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';
import EventUserReport from '../components/events/userReport';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t, tct} from '../locale';
import withEnvironment from '../utils/withEnvironment';

const GroupUserReports = createReactClass({
  displayName: 'GroupUserReports',

  propTypes: {
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin, GroupState],

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

  componentDidUpdate(prevProps) {
    if (
      prevProps.location.search !== this.props.location.search ||
      prevProps.environment !== this.props.environment
    ) {
      this.fetchData();
    }
  },

  fetchData() {
    const queryParams = {...this.props.params};

    if (this.props.environment) {
      queryParams.environment = this.props.environment.name;
    }

    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(`/issues/${this.getGroup().id}/user-reports/`, {
      query: queryParams,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: error => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  getUserReportsUrl() {
    let params = this.props.params;

    return `/${params.orgId}/${params.projectId}/settings/user-feedback/`;
  },

  render() {
    let {reportList} = this.state;
    let {projectId, orgId, groupId} = this.props.params;

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (reportList.length) {
      return (
        <div className="row">
          <div className="col-md-9">
            {reportList.map((item, idx) => {
              return (
                <EventUserReport
                  key={idx}
                  report={item}
                  projectId={projectId}
                  orgId={orgId}
                  issueId={groupId}
                />
              );
            })}
          </div>
        </div>
      );
    }

    const emptyStateMessage = this.props.environment
      ? tct('No user reports have been collected from your [env] environment.', {
          env: this.props.environment.displayName,
        })
      : t('No user reports have been collected.');

    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{emptyStateMessage}</p>
        <p>
          <Link to={this.getUserReportsUrl()}>
            {t('Learn how to integrate User Feedback')}
          </Link>
        </p>
      </div>
    );
  },
});

export default withEnvironment(GroupUserReports);
