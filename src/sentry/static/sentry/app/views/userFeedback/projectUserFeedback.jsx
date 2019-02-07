import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link, browserHistory} from 'react-router';
import qs from 'query-string';
import {omit, isEqual} from 'lodash';
import SentryTypes from 'app/sentryTypes';
import ApiMixin from 'app/mixins/apiMixin';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import CompactIssue from 'app/components/compactIssue';
import EventUserFeedback from 'app/components/events/userFeedback';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t, tct} from 'app/locale';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import withOrganization from 'app/utils/withOrganization';

import UserFeedbackContainer from './container';

const ProjectUserFeedback = createReactClass({
  displayName: 'ProjectUserFeedback',

  propTypes: {
    organization: SentryTypes.Organization.isRequired,
    defaultQuery: PropTypes.string,
    defaultStatus: PropTypes.string,
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    project: SentryTypes.Project,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      defaultQuery: '',
      defaultStatus: 'unresolved',
    };
  },

  getInitialState() {
    return {
      reportList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: this.props.defaultQuery,
      status: this.props.defaultStatus,
      environment: this.props.environment,
      ...this.getQueryStringState(this.props),
    };
  },

  componentWillMount() {
    // Redirect any Sentry 10 user that has followed an old link and ended up here
    const {organization, params: {orgId}} = this.props;
    const hasSentry10 = new Set(organization.features).has('sentry10');
    if (hasSentry10) {
      const projectId = this.context.project.id;
      browserHistory.replace(
        `/organizations/${orgId}/user-feedback/?project=${projectId}`
      );
    }

    this.props.setProjectNavSection('user-feedback');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    // Ignore changes to environment term since this is handled separately
    const nextSearchTerm = omit(qs.parse(nextProps.location.search), 'environment');
    const thisSearchTerm = omit(qs.parse(this.props.location.search), 'environment');

    if (!isEqual(nextSearchTerm, thisSearchTerm)) {
      this.setState(this.getQueryStringState(nextProps), this.fetchData);
    }

    if (nextProps.environment !== this.props.environment) {
      this.setState(
        {
          environment: nextProps.environment,
        },
        this.fetchData
      );
    }
  },

  getQueryStringState(props) {
    const q = props.location.query;
    const status = 'status' in q ? q.status : this.props.defaultStatus;
    const query = 'query' in q ? q.query : this.props.defaultQuery;

    return {
      query,
      status,
    };
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const params = this.props.params;

    const query = {
      ...this.props.location.query,
      per_page: 50,
      query: this.state.query,
      status: this.state.status,
    };

    if (this.state.environment) {
      query.environment = this.state.environment.name;
    } else {
      delete query.environment;
    }

    this.api.request(`/projects/${params.orgId}/${params.projectId}/user-reports/`, {
      query,
      success: (data, _, jqXHR) => {
        const issues = data.map(r => r.issue);
        GroupStore.add(issues);
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  getUserFeedbackUrl() {
    const params = this.props.params;

    return `/${params.orgId}/${params.projectId}/settings/user-feedback/`;
  },

  renderStreamBody() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    } else if (this.state.reportList.length > 0) {
      return this.renderResults();
    } else if (this.state.query && this.state.query !== this.props.defaultQuery) {
      return this.renderNoQueryResults();
    } else {
      return this.renderEmpty();
    }
  },

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no results match your search query.')}</p>
      </EmptyStateWarning>
    );
  },

  renderEmpty() {
    const {environment} = this.state;
    const message = environment
      ? tct('No user reports have been collected from your [env] environment.', {
          env: environment.displayName,
        })
      : t('No user reports have been collected.');
    return (
      <EmptyStateWarning>
        <p>{message}</p>
        <p>
          <Link to={this.getUserFeedbackUrl()}>
            {t('Learn how to integrate User Feedback')}
          </Link>
        </p>
      </EmptyStateWarning>
    );
  },

  renderResults() {
    const {orgId, projectId} = this.props.params;

    const children = this.state.reportList.map(item => {
      const issue = item.issue;

      return (
        <CompactIssue key={item.id} id={issue.id} data={issue}>
          <EventUserFeedback
            report={item}
            orgId={orgId}
            projectId={projectId}
            issueId={issue.id}
          />
        </CompactIssue>
      );
    });

    return children;
  },

  render() {
    const {location} = this.props;

    return (
      <UserFeedbackContainer
        pageLinks={this.state.pageLinks}
        status={this.state.status}
        location={location}
      >
        {this.renderStreamBody()}
      </UserFeedbackContainer>
    );
  },
});

export {ProjectUserFeedback};
export default withOrganization(withEnvironmentInQueryString(ProjectUserFeedback));
