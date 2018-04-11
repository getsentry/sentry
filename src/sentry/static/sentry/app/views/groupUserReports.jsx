import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import {omit, isEqual} from 'lodash';
import qs from 'query-string';

import SentryTypes from '../proptypes';
import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';
import EventUserReport from '../components/events/userReport';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t, tct} from '../locale';
import withEnvironmentInQueryString from '../utils/withEnvironmentInQueryString';
import EmptyStateWarning from '../components/emptyStateWarning';
import {Panel} from '../components/panels';

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
    // Search term has changed (excluding environment)
    const searchHasChanged = !isEqual(
      omit(qs.parse(prevProps.location.search), 'environment'),
      omit(qs.parse(this.props.location.search), 'environment')
    );
    const environmentHasChanged = prevProps.environment !== this.props.environment;

    if (searchHasChanged || environmentHasChanged) {
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
      <Panel>
        <EmptyStateWarning>
          <p>{emptyStateMessage}</p>
          <p>
            <Link to={this.getUserReportsUrl()}>
              {t('Learn how to integrate User Feedback')}
            </Link>
          </p>
        </EmptyStateWarning>
      </Panel>
    );
  },
});

export default withEnvironmentInQueryString(GroupUserReports);
