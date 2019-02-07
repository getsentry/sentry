import {browserHistory} from 'react-router';
import {omit, isEqual, sortBy} from 'lodash';
import Cookies from 'js-cookie';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import qs from 'query-string';

import {Panel, PanelBody} from 'app/components/panels';
import {analytics} from 'app/utils/analytics';
import {logAjaxError} from 'app/utils/logging';
import {
  setActiveEnvironment,
  setActiveEnvironmentName,
} from 'app/actionCreators/environments';
import {t, tct} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import ConfigStore from 'app/stores/configStore';
import EnvironmentStore from 'app/stores/environmentStore';
import ErrorRobot from 'app/components/errorRobot';
import {fetchSavedSearches} from 'app/actionCreators/savedSearches';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import ProcessingIssueList from 'app/components/stream/processingIssueList';
import ProjectState from 'app/mixins/projectState';
import SentryTypes from 'app/sentryTypes';
import StreamActions from 'app/views/stream/actions';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import StreamFilters from 'app/views/stream/filters';
import StreamGroup from 'app/components/stream/group';
import StreamSidebar from 'app/views/stream/sidebar';
import parseApiError from 'app/utils/parseApiError';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import queryString from 'app/utils/queryString';
import utils from 'app/utils';

const MAX_ITEMS = 25;
const DEFAULT_SORT = 'date';
const DEFAULT_STATS_PERIOD = '24h';
const STATS_PERIODS = new Set(['14d', '24h']);

const Stream = createReactClass({
  displayName: 'Stream',

  propTypes: {
    environment: SentryTypes.Environment,
    tags: PropTypes.object,
    tagsLoading: PropTypes.bool,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange'), ApiMixin, ProjectState],

  getInitialState() {
    const searchId = this.props.params.searchId || null;
    const project = this.getProject();
    const realtimeActiveCookie = Cookies.get('realtimeActive');
    const realtimeActive =
      typeof realtimeActiveCookie === 'undefined'
        ? project && !project.firstEvent
        : realtimeActiveCookie === 'true';

    const currentQuery = this.props.location.query || {};
    const sort = 'sort' in currentQuery ? currentQuery.sort : DEFAULT_SORT;

    const hasQuery = 'query' in currentQuery;
    const statsPeriod = STATS_PERIODS.has(currentQuery.statsPeriod)
      ? currentQuery.statsPeriod
      : DEFAULT_STATS_PERIOD;

    return {
      groupIds: [],
      isDefaultSearch: false,
      searchId: hasQuery ? null : searchId,
      // if we have no query then we can go ahead and fetch data
      loading: !!searchId || !hasQuery,
      savedSearchLoading: true,
      savedSearchList: [],
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod,
      realtimeActive,
      pageLinks: '',
      queryCount: null,
      dataLoading: true,
      error: false,
      query: hasQuery ? currentQuery.query : '',
      sort,
      isSidebarVisible: false,
      environment: this.props.environment,
    };
  },

  componentWillMount() {
    const organization = this.getOrganization();
    const hasSentry10 = new Set(organization.features).has('sentry10');

    if (hasSentry10) {
      const project = this.getProject();
      const {location} = this.props;
      const query = qs.parse(location.search);
      query.project = project.id;

      browserHistory.replace(
        `/organizations/${organization.slug}/issues/?${qs.stringify(query)}`
      );
    }

    this._streamManager = new utils.StreamManager(GroupStore);
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll,
    });

    this.fetchSavedSearches();
    if (!this.state.loading) {
      this.fetchData();
    }
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.environment !== this.props.environment) {
      this.setState(
        {
          environment: nextProps.environment,
        },
        this.fetchData
      );
    }

    // you cannot apply both a query and a saved search (our routes do not
    // support it), so the searchId takes priority
    const nextSearchId = nextProps.params.searchId;

    const searchIdChanged = this.state.isDefaultSearch
      ? nextSearchId !== undefined
      : nextSearchId !== this.props.params.searchId;

    // We are using qs.parse with location.search since this.props.location.query
    // returns the same value as nextProps.location.query
    const currentSearchTerm = qs.parse(this.props.location.search);
    const nextSearchTerm = qs.parse(nextProps.location.search);

    const searchTermChanged = !isEqual(
      omit(currentSearchTerm, 'environment'),
      omit(nextSearchTerm, 'environment')
    );

    if (searchIdChanged || searchTermChanged) {
      this.setState(this.getQueryState(nextProps), this.fetchData);
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevState.realtimeActive !== this.state.realtimeActive) {
      // User toggled realtime button
      if (this.state.realtimeActive) {
        this.resumePolling();
      } else {
        this._poller.disable();
      }
    }
  },

  componentWillUnmount() {
    this._poller.disable();
    GroupStore.reset();
  },

  fetchSavedSearches() {
    this.setState({
      savedSearchLoading: true,
    });

    const {orgId, projectId} = this.props.params;
    const {searchId} = this.state;

    fetchSavedSearches(this.api, orgId, projectId).then(
      data => {
        const newState = {
          isDefaultSearch: false,
          savedSearchLoading: false,
          savedSearchList: data,
          loading: false,
        };
        const needsData = this.state.loading;
        if (searchId) {
          const match = data.find(search => search.id === searchId);

          if (match) {
            newState.query = match.query;
          } else {
            this.setState(
              {
                savedSearchLoading: false,
                savedSearchList: data,
                searchId: null,
                isDefaultSearch: true,
              },
              this.transitionTo
            );
          }
        } else if (!this.hasQuery()) {
          const defaultResult =
            data.find(search => search.isUserDefault) ||
            data.find(search => search.isDefault);

          if (defaultResult) {
            // Check if there is an environment specified in the default search
            const envName = queryString.getQueryEnvironment(defaultResult.query);
            const env = EnvironmentStore.getByName(envName);
            if (env) {
              setActiveEnvironment(env);
            }

            newState.searchId = defaultResult.id;

            newState.query = queryString.getQueryStringWithoutEnvironment(
              defaultResult.query
            );
            newState.isDefaultSearch = true;
          }
        }

        this.setState(newState, needsData ? this.fetchData : null);
      },
      error => {
        // XXX(dcramer): fail gracefully by still loading the stream
        logAjaxError(error);
        this.setState({
          loading: false,
          isDefaultSearch: null,
          searchId: null,
          savedSearchList: [],
          savedSearchLoading: false,
          query: '',
        });
      }
    );
  },

  onSavedSearchCreate(data) {
    const savedSearchList = this.state.savedSearchList;
    savedSearchList.push(data);

    this.setState(
      {
        savedSearchList: sortBy(savedSearchList, ['name']),
        searchId: data.id,
      },
      this.transitionTo
    );
  },

  onSavedSearchSelect(search) {
    this.setState({searchId: search.id}, this.transitionTo);
  },

  getQueryState(props) {
    const currentQuery = props.location.query || {};

    const hasQuery = 'query' in currentQuery;

    const searchId = hasQuery
      ? null
      : props.params.searchId || this.state.searchId || null;

    const sort = 'sort' in currentQuery ? currentQuery.sort : DEFAULT_SORT;

    const statsPeriod = STATS_PERIODS.has(currentQuery.statsPeriod)
      ? currentQuery.statsPeriod
      : DEFAULT_STATS_PERIOD;

    const newState = {
      sort,
      statsPeriod,
      query: hasQuery ? currentQuery.query : '',
      searchId,
      isDefaultSearch: false,
    };

    if (searchId) {
      const searchResult = this.state.savedSearchList.find(
        search => search.id === searchId
      );
      if (searchResult) {
        // New behavior is that we no longer support environment in saved search
        // We check if the query contains a valid environment and update the global setting if so
        // We'll always strip environment from the querystring whether valid or not
        const queryEnv = queryString.getQueryEnvironment(searchResult.query);
        if (queryEnv) {
          const env = EnvironmentStore.getByName(queryEnv);
          setActiveEnvironment(env);
        }
        newState.query = queryString.getQueryStringWithoutEnvironment(searchResult.query);

        if (this.state.searchId && !props.params.searchId) {
          newState.isDefaultSearch = true;
        }
      } else {
        newState.searchId = null;
      }
    } else if (!hasQuery) {
      const defaultResult = this.state.savedSearchList.find(search => search.isDefault);
      if (defaultResult) {
        newState.isDefaultSearch = true;
        newState.searchId = defaultResult.id;
        newState.query = defaultResult.query;
      } else {
        newState.searchId = null;
      }
    }
    newState.loading = false;
    return newState;
  },

  hasQuery(props) {
    props = props || this.props;
    const currentQuery = props.location.query || {};
    return 'query' in currentQuery;
  },

  fetchData() {
    GroupStore.loadInitialData([]);

    this.setState({
      dataLoading: true,
      queryCount: null,
      error: false,
    });

    const url = this.getGroupListEndpoint();

    // Remove leading and trailing whitespace
    const query = queryString.formatQueryString(this.state.query);

    const {environment} = this.state;

    const requestParams = {
      query,
      limit: MAX_ITEMS,
      sort: this.state.sort,
      statsPeriod: this.state.statsPeriod,
      shortIdLookup: '1',
    };

    // Always keep the global active environment in sync with the queried environment
    // The global environment wins unless there one is specified by the saved search
    const queryEnvironment = queryString.getQueryEnvironment(query);

    if (queryEnvironment !== null) {
      requestParams.environment = queryEnvironment;
    } else if (environment) {
      requestParams.environment = environment.name;
    }

    const currentQuery = this.props.location.query || {};
    if ('cursor' in currentQuery) {
      requestParams.cursor = currentQuery.cursor;
    }

    if (this.lastRequest) {
      this.lastRequest.cancel();
    }

    this._poller.disable();

    this.lastRequest = this.api.request(url, {
      method: 'GET',
      data: requestParams,
      success: (data, ignore, jqXHR) => {
        // if this is a direct hit, we redirect to the intended result directly.
        // we have to use the project slug from the result data instead of the
        // the current props one as the shortIdLookup can return results for
        // different projects.
        if (jqXHR.getResponseHeader('X-Sentry-Direct-Hit') === '1') {
          if (data && data[0].matchingEventId) {
            const {project, id, matchingEventId, matchingEventEnvironment} = data[0];
            let redirect = `/${this.props.params
              .orgId}/${project.slug}/issues/${id}/events/${matchingEventId}/`;
            // Also direct to the environment of this specific event if this
            // key exists. We need to explicitly check against undefined becasue
            // an environment name may be an empty string, which is perfectly valid.
            if (typeof matchingEventEnvironment !== 'undefined') {
              setActiveEnvironmentName(matchingEventEnvironment);
              redirect = `${redirect}?${qs.stringify({
                environment: matchingEventEnvironment,
              })}`;
            }
            return void browserHistory.replace(redirect);
          }
        }

        this._streamManager.push(data);

        const queryCount = jqXHR.getResponseHeader('X-Hits');
        const queryMaxCount = jqXHR.getResponseHeader('X-Max-Hits');

        return void this.setState({
          error: false,
          dataLoading: false,
          query,
          queryCount:
            typeof queryCount !== 'undefined' ? parseInt(queryCount, 10) || 0 : 0,
          queryMaxCount:
            typeof queryMaxCount !== 'undefined' ? parseInt(queryMaxCount, 10) || 0 : 0,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: err => {
        this.setState({
          error: parseApiError(err),
          dataLoading: false,
        });
      },
      complete: jqXHR => {
        this.lastRequest = null;

        this.resumePolling();
      },
    });
  },

  resumePolling() {
    if (!this.state.pageLinks) return;

    // Only resume polling if we're on the first page of results
    const links = parseLinkHeader(this.state.pageLinks);
    if (links && !links.previous.results && this.state.realtimeActive) {
      this._poller.setEndpoint(links.previous.href);
      this._poller.enable();
    }
  },

  getGroupListEndpoint() {
    const params = this.props.params;

    return '/projects/' + params.orgId + '/' + params.projectId + '/issues/';
  },

  onRealtimeChange(realtime) {
    Cookies.set('realtimeActive', realtime.toString());
    this.setState({
      realtimeActive: realtime,
    });
  },

  onSelectStatsPeriod(period) {
    if (period != this.state.statsPeriod) {
      // TODO(dcramer): all charts should now suggest "loading"
      this.setState(
        {
          statsPeriod: period,
        },
        function() {
          this.transitionTo();
        }
      );
    }
  },

  onRealtimePoll(data, links) {
    this._streamManager.unshift(data);
    if (!utils.valueIsEqual(this.state.pageLinks, links, true)) {
      this.setState({
        pageLinks: links,
      });
    }
  },

  onGroupChange() {
    const groupIds = this._streamManager.getAllItems().map(item => item.id);
    if (!utils.valueIsEqual(groupIds, this.state.groupIds)) {
      this.setState({
        groupIds,
      });
    }
  },

  onSearch(query) {
    if (query === this.state.query) {
      // if query is the same, just re-fetch data
      this.fetchData();
    } else {
      // We no longer want to support environments specified in the querystring
      // To keep this aligned with old behavior though we'll update the global environment
      // and remove it from the query if someone does provide it this way
      const queryEnvironment = queryString.getQueryEnvironment(query);
      if (queryEnvironment !== null) {
        const env = EnvironmentStore.getByName(queryEnvironment);
        setActiveEnvironment(env);
      }
      query = queryString.getQueryStringWithoutEnvironment(query);

      this.setState(
        {
          query,
          searchId: null,
        },
        this.transitionTo
      );
    }

    // Ignore saved searches
    if (this.state.savedSearchList.map(s => s.query == this.state.query).length > 0) {
      const {orgId, projectId} = this.props.params;
      analytics('issue.search', {
        query: this.state.query,
        organization_id: orgId,
        project_id: projectId,
      });
    }
  },

  onSortChange(sort) {
    this.setState(
      {
        sort,
      },
      this.transitionTo
    );
  },

  onSidebarToggle() {
    const org = this.getOrganization();
    this.setState({
      isSidebarVisible: !this.state.isSidebarVisible,
    });
    analytics('issue.search_sidebar_clicked', {
      org_id: parseInt(org.id, 10),
    });
  },

  /**
   * Returns true if all results in the current query are visible/on this page
   */
  allResultsVisible() {
    if (!this.state.pageLinks) return false;

    const links = parseLinkHeader(this.state.pageLinks);
    return links && !links.previous.results && !links.next.results;
  },

  transitionTo() {
    const queryParams = {};

    if (this.props.location.query.environment) {
      queryParams.environment = this.props.location.query.environment;
    }

    if (!this.state.searchId) {
      queryParams.query = this.state.query;
    }

    if (this.state.sort !== DEFAULT_SORT) {
      queryParams.sort = this.state.sort;
    }

    if (this.state.statsPeriod !== DEFAULT_STATS_PERIOD) {
      queryParams.statsPeriod = this.state.statsPeriod;
    }

    const params = this.props.params;

    const path = this.state.searchId
      ? `/${params.orgId}/${params.projectId}/searches/${this.state.searchId}/`
      : `/${params.orgId}/${params.projectId}/`;
    browserHistory.push({
      pathname: path,
      query: queryParams,
    });
  },

  renderGroupNodes(ids, statsPeriod) {
    // Restrict this guide to only show for new users (joined<30 days) and add guide anhor only to the first issue
    const userDateJoined = new Date(ConfigStore.get('user').dateJoined);
    const dateCutoff = new Date();
    dateCutoff.setDate(dateCutoff.getDate() - 30);

    const topIssue = ids[0];

    const {orgId} = this.props.params;
    const groupNodes = ids.map(id => {
      const hasGuideAnchor = userDateJoined > dateCutoff && id === topIssue;
      return (
        <StreamGroup
          key={id}
          id={id}
          orgId={orgId}
          statsPeriod={statsPeriod}
          query={this.state.query}
          hasGuideAnchor={hasGuideAnchor}
        />
      );
    });
    return <PanelBody className="ref-group-list">{groupNodes}</PanelBody>;
  },

  renderAwaitingEvents() {
    const org = this.getOrganization();
    const project = this.getProject();
    const sampleIssueId = this.state.groupIds.length > 0 ? this.state.groupIds[0] : '';
    return (
      <ErrorRobot
        org={org}
        project={project}
        sampleIssueId={sampleIssueId}
        gradient={true}
      />
    );
  },

  renderEmpty() {
    const {environment} = this.state;
    const message = environment
      ? tct('Sorry no events match your filters in the [env] environment.', {
          env: environment.displayName,
        })
      : t('Sorry, no events match your filters.');

    return (
      <EmptyStateWarning>
        <p>{message}</p>
      </EmptyStateWarning>
    );
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderStreamBody() {
    let body;
    const project = this.getProject();

    if (project.firstEvent) {
      ConfigStore.set('sentFirstEvent', project.firstEvent);
    }

    if (this.state.dataLoading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    } else if (this.state.groupIds.length > 0) {
      body = this.renderGroupNodes(this.state.groupIds, this.state.statsPeriod);
    } else if (!project.firstEvent) {
      body = this.renderAwaitingEvents();
    } else {
      body = this.renderEmpty();
    }
    return body;
  },

  render() {
    // global loading
    if (this.state.loading) {
      return this.renderLoading();
    }
    const params = this.props.params;
    const classes = ['stream-row'];
    if (this.state.isSidebarVisible) classes.push('show-sidebar');
    const {orgId, projectId} = this.props.params;
    const {organization} = this.context;

    const searchId = this.state.searchId;
    const access = this.getAccess();
    const projectFeatures = this.getProjectFeatures();
    const project = this.getProject();

    return (
      <div className={classNames(classes)}>
        <div className="stream-content">
          <StreamFilters
            access={access}
            orgId={orgId}
            projectId={projectId}
            query={this.state.query}
            sort={this.state.sort}
            searchId={searchId}
            queryCount={this.state.queryCount}
            queryMaxCount={this.state.queryMaxCount}
            onSortChange={this.onSortChange}
            onSearch={this.onSearch}
            onSavedSearchCreate={this.onSavedSearchCreate}
            onSavedSearchSelect={this.onSavedSearchSelect}
            onSidebarToggle={this.onSidebarToggle}
            isSearchDisabled={this.state.isSidebarVisible}
            savedSearchList={this.state.savedSearchList}
          />
          <Panel>
            <StreamActions
              orgId={params.orgId}
              projectId={params.projectId}
              hasReleases={projectFeatures.has('releases')}
              latestRelease={this.context.project.latestRelease}
              environment={this.state.environment}
              query={this.state.query}
              queryCount={this.state.queryCount}
              onSelectStatsPeriod={this.onSelectStatsPeriod}
              onRealtimeChange={this.onRealtimeChange}
              realtimeActive={this.state.realtimeActive}
              statsPeriod={this.state.statsPeriod}
              groupIds={this.state.groupIds}
              allResultsVisible={this.allResultsVisible()}
            />
            <PanelBody>
              <ProcessingIssueList organization={organization} project={project} />
              {this.renderStreamBody()}
            </PanelBody>
          </Panel>
          <Pagination pageLinks={this.state.pageLinks} />
        </div>
        <StreamSidebar
          loading={this.props.tagsLoading}
          tags={this.props.tags}
          query={this.state.query}
          onQueryChange={this.onSearch}
          orgId={params.orgId}
          projectId={params.projectId}
        />
      </div>
    );
  },
});
export default Stream;
