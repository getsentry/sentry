import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';
import {Box} from 'grid-emotion';
import {omit, isEqual} from 'lodash';
import qs from 'query-string';

import SentryTypes from 'app/proptypes';
import ApiMixin from 'app/mixins/apiMixin';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import SearchBar from 'app/components/searchBar';
import {t, tct} from 'app/locale';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';

import ReleaseList from 'app/views/projectReleases/releaseList';

import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';

const DEFAULT_QUERY = '';

const ProjectReleases = createReactClass({
  displayName: 'ProjectReleases',

  propTypes: {
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin],

  getInitialState() {
    let queryParams = this.props.location.query;

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
    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    const searchHasChanged = !isEqual(
      omit(qs.parse(nextProps.location.search), 'environment'),
      omit(qs.parse(this.props.location.search), 'environment')
    );

    if (searchHasChanged) {
      let queryParams = nextProps.location.query;
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
    let targetQueryParams = {};
    if (query !== '') targetQueryParams.query = query;

    let {orgId, projectId} = this.props.params;
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

  getReleaseTrackingUrl() {
    let params = this.props.params;

    return '/' + params.orgId + '/' + params.projectId + '/settings/release-tracking/';
  },

  renderStreamBody() {
    let body;

    let params = this.props.params;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.releaseList.length > 0)
      body = (
        <ReleaseList
          orgId={params.orgId}
          projectId={params.projectId}
          releaseList={this.state.releaseList}
        />
      );
    else if (this.state.query && this.state.query !== DEFAULT_QUERY)
      body = this.renderNoQueryResults();
    else body = this.renderEmpty();

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
    const message = environment
      ? tct("There don't seem to be any releases in your [env] environment yet", {
          env: environment.displayName,
        })
      : t("There don't seem to be any releases yet.");

    return (
      <EmptyStateWarning>
        <p>{message}</p>
        <p>
          <a href={this.getReleaseTrackingUrl()}>
            {t('Learn how to integrate Release Tracking')}
          </a>
        </p>
      </EmptyStateWarning>
    );
  },

  render() {
    return (
      <div className="ref-project-releases">
        <GuideAnchor target="releases" type="invisible" />
        <div className="row release-list-header">
          <div className="col-sm-7">
            <h3>{t('Releases')}</h3>
          </div>
          <div className="col-sm-5 release-search">
            <SearchBar
              defaultQuery=""
              placeholder={t('Search for a release')}
              query={this.state.query}
              onSearch={this.onSearch}
            />
          </div>
        </div>
        <Panel>
          <PanelHeader>
            <Box flex="1">{t('Version')}</Box>
            <Box w={4 / 12} pl={2} className="hidden-xs" />
            <Box w={2 / 12} pl={2}>
              {t('New Issues')}
            </Box>
            <Box w={2 / 12} pl={2}>
              {t('Last Event')}
            </Box>
          </PanelHeader>
          <PanelBody>{this.renderStreamBody()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },
});

export {ProjectReleases}; // For tests
export default withEnvironmentInQueryString(ProjectReleases);
