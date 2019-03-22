import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import {omit, isEqual} from 'lodash';
import qs from 'query-string';

import {analytics} from 'app/utils/analytics';
import SentryTypes from 'app/sentryTypes';
import ApiMixin from 'app/mixins/apiMixin';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import SearchBar from 'app/components/searchBar';
import {t, tct} from 'app/locale';
import {Panel, PanelBody} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import PageHeading from 'app/components/pageHeading';
import ReleaseLanding from '../shared/releaseLanding';
import ReleaseEmptyState from './releaseEmptyState';
import ReleaseList from '../shared/releaseList';
import ReleaseListHeader from '../shared/releaseListHeader';
import ReleaseProgress from '../shared/releaseProgress';

const DEFAULT_QUERY = '';

const ProjectReleases = createReactClass({
  displayName: 'ProjectReleases',

  propTypes: {
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  },

  mixins: [ApiMixin],

  getInitialState() {
    const queryParams = this.props.location.query;

    return {
      releaseList: [],
      loading: true,
      error: false,
      query: queryParams.query || DEFAULT_QUERY,
      pageLinks: '',
      environment: this.props.environment,
    };
  },

  componentWillMount() {
    // Redirect any Sentry 10 user that has followed an old link and ended up here
    const {location, params: {orgId}} = this.props;
    const hasSentry10 = new Set(this.context.organization.features).has('sentry10');
    if (hasSentry10) {
      browserHistory.replace(`/organizations/${orgId}/releases/${location.search}`);
    }

    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  componentDidMount() {
    const {organization, project} = this.context;

    analytics('releases.tab_viewed', {
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
    });
  },

  componentWillReceiveProps(nextProps) {
    const searchHasChanged = !isEqual(
      omit(qs.parse(nextProps.location.search), 'environment'),
      omit(qs.parse(this.props.location.search), 'environment')
    );

    if (searchHasChanged) {
      const queryParams = nextProps.location.query;
      this.setState(
        {
          query: queryParams.query,
        },
        this.fetchData
      );
    }

    if (nextProps.environment !== this.props.environment) {
      this.setState({environment: nextProps.environment}, this.fetchData);
    }
  },

  onSearch(query) {
    const targetQueryParams = {};
    if (query !== '') {
      targetQueryParams.query = query;
    }

    const {orgId, projectId} = this.props.params;
    browserHistory.push({
      pathname: `/${orgId}/${projectId}/releases/`,
      query: targetQueryParams,
    });
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const {orgId, projectId} = this.props.params;

    const url = `/projects/${orgId}/${projectId}/releases/`;

    const query = {
      ...this.props.location.query,
      per_page: 20,
      query: this.state.query,
    };

    if (this.state.environment) {
      query.environment = this.state.environment.name;
    } else {
      delete query.environment;
    }

    this.api.request(url, {
      query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          releaseList: data,
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

  renderStreamBody() {
    let body;
    const {params} = this.props;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError onRetry={this.fetchData} />;
    } else if (this.state.releaseList.length > 0) {
      body = (
        <div>
          <ReleaseProgress project={this.context.project} />
          <ReleaseList
            orgId={params.orgId}
            projectId={params.projectId}
            releaseList={this.state.releaseList}
          />
        </div>
      );
    } else if (this.state.query && this.state.query !== DEFAULT_QUERY) {
      body = this.renderNoQueryResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no releases match your filters.')}</p>
      </EmptyStateWarning>
    );
  },

  renderEmpty() {
    const {environment} = this.state;
    const {project} = this.context;
    const anyProjectReleases = project.latestRelease;

    const message = environment
      ? tct("There don't seem to be any releases in your [env] environment yet", {
          env: environment.displayName,
        })
      : t("There don't seem to be any releases yet.");

    return anyProjectReleases === null ? (
      <ReleaseLanding />
    ) : (
      <div>
        <ReleaseProgress project={project} />
        <ReleaseEmptyState message={message} />
      </div>
    );
  },

  render() {
    return (
      <div className="ref-project-releases">
        <GuideAnchor target="releases" type="invisible" />
        <div className="row" style={{marginBottom: '5px'}}>
          <div className="col-sm-7">
            <PageHeading withMargins>{t('Releases')}</PageHeading>
          </div>
          <div className="col-sm-5 release-search" style={{marginTop: '5px'}}>
            <SearchBar
              defaultQuery=""
              placeholder={t('Search for a release')}
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>
        <Panel>
          <ReleaseListHeader />
          <PanelBody>{this.renderStreamBody()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },
});

export {ProjectReleases}; // For tests
export default withEnvironmentInQueryString(ProjectReleases);
