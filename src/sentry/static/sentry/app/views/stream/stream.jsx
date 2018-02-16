import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link, browserHistory} from 'react-router';
import Cookies from 'js-cookie';
import {StickyContainer, Sticky} from 'react-sticky';
import classNames from 'classnames';
import _ from 'lodash';

import ApiMixin from '../../mixins/apiMixin';

import EnvironmentStore from '../../stores/environmentStore';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import Pagination from '../../components/pagination';
import StreamGroup from '../../components/stream/group';
import StreamActions from './../stream/actions';

import StreamFilters from '../stream/filters';
import StreamSidebar from '../stream/sidebar';
import TimeSince from '../../components/timeSince';
import streamUtils from './utils';
import utils from '../../utils';
import {logAjaxError} from '../../utils/logging';
import parseLinkHeader from '../../utils/parseLinkHeader';
import {t, tn, tct} from '../../locale';

import {setActiveEnvironment} from '../../actionCreators/environments';
import {addIssues} from '../../actionCreators/groups';

const DEFAULT_SORT = 'date';
const DEFAULT_STATS_PERIOD = '24h';
const MAX_ITEMS = 25;

const Stream = createReactClass({
  displayName: 'Stream',

  propTypes: {
    organization: PropTypes.object,
    project: PropTypes.object,
    environment: PropTypes.object,
    tags: PropTypes.object,
    tagsLoading: PropTypes.bool,
    groupIds: PropTypes.array,
  },

  mixins: [ApiMixin],

  getInitialState() {
    let searchId = this.props.params.searchId || null;
    let project = this.props.project;
    let realtimeActiveCookie = Cookies.get('realtimeActive');
    let realtimeActive =
      typeof realtimeActiveCookie === 'undefined'
        ? project && !project.firstEvent
        : realtimeActiveCookie === 'true';

    return {
      isDefaultSearch: null,
      searchId,
      // if we have no query then we can go ahead and fetch data
      loading: searchId || !this.hasQuery() ? true : false,
      savedSearchLoading: true,
      savedSearchList: [],
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod: DEFAULT_STATS_PERIOD,
      realtimeActive,
      pageLinks: '',
      queryCount: null,
      dataLoading: true,
      error: false,
      query: '',
      sort: DEFAULT_SORT,
      isSidebarVisible: false,
      processingIssues: null,
      ...this.getQueryState(),
    };
  },

  componentWillMount() {
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll,
    });

    this.fetchSavedSearches();
    this.fetchProcessingIssues();
  },

  componentWillReceiveProps(nextProps) {
    // if (this.state.loading) {
    //   return;
    // }

    // Do not make new API request if props haven't actually changed
    // Unless no request has been performed yet
    if (!_.isEqual(this.props, nextProps)) {
      this.fetchData({environment: nextProps.environment});
    }

    // you cannot apply both a query and a saved search (our routes do not
    // support it), so the searchId takes priority
    let nextSearchId = nextProps.params.searchId || null;

    let searchIdChanged = this.state.isDefaultSearch
      ? nextSearchId
      : nextSearchId !== this.state.searchId;

    if (searchIdChanged || nextProps.location.search !== this.props.location.search) {
      // TODO(dcramer): handle 404 from popState on searchId
      this.setState(this.getQueryState(nextProps), this.fetchData);
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(this.state, nextState);
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
  },

  fetchSavedSearches() {
    this.setState({
      savedSearchLoading: true,
    });

    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/searches/`, {
      success: data => {
        let newState = {
          isDefaultSearch: false,
          savedSearchLoading: false,
          savedSearchList: data,
          loading: false,
        };
        let searchId = this.state.searchId;
        let needsData = this.state.loading;
        if (searchId) {
          let match = data.filter(search => {
            return search.id === searchId;
          });
          if (match.length) {
            newState.query = match[0].query;
          } else {
            return void this.setState(
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
          let defaultResults = data.filter(search => {
            return search.isUserDefault;
          });

          if (!defaultResults.length) {
            defaultResults = data.filter(search => {
              return search.isDefault;
            });
          }

          if (defaultResults.length) {
            newState.searchId = defaultResults[0].id;
            newState.query = defaultResults[0].query;
            newState.isDefaultSearch = true;
          }
        }

        return void this.setState(newState, needsData ? this.fetchData : null);
      },
      error: error => {
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
      },
    });
  },

  fetchProcessingIssues() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/processingissues/`, {
      success: data => {
        if (data.hasIssues || data.resolveableIssues > 0 || data.issuesProcessing > 0) {
          this.setState({
            processingIssues: data,
          });
        }
      },
      error: error => {
        logAjaxError(error);
        // this is okay. it's just a ui hint
      },
    });
  },

  showingProcessingIssues() {
    return this.state.query && this.state.query.trim() == 'is:unprocessed';
  },

  onSavedSearchCreate(data) {
    let {orgId, projectId} = this.props.params;
    let savedSearchList = this.state.savedSearchList;
    savedSearchList.push(data);
    // TODO(dcramer): sort
    this.setState({
      savedSearchList,
    });
    browserHistory.push(`/${orgId}/${projectId}/searches/${data.id}/`);
  },

  getQueryState(props) {
    props = props || this.props;
    let currentQuery = props.location.query || {};
    // state may not yet be defined at this point
    let state = this.state || {};

    let hasQuery = 'query' in currentQuery;

    let searchId = hasQuery ? null : props.params.searchId || state.searchId || null;

    let sort = 'sort' in currentQuery ? currentQuery.sort : DEFAULT_SORT;

    let statsPeriod =
      'statsPeriod' in currentQuery ? currentQuery.statsPeriod : DEFAULT_STATS_PERIOD;

    if (statsPeriod !== '14d' && statsPeriod !== '24h') {
      statsPeriod = DEFAULT_STATS_PERIOD;
    }

    let newState = {
      sort,
      statsPeriod,
      query: hasQuery ? currentQuery.query : '',
      searchId,
      isDefaultSearch: false,
    };

    // state is not yet defined
    if (this.state === null) return newState;

    if (searchId) {
      let searchResult = this.state.savedSearchList.filter(search => {
        return search.id === searchId;
      });
      if (searchResult.length) {
        newState.query = searchResult[0].query;
      } else {
        newState.searchId = null;
      }
    } else if (!hasQuery) {
      let defaultResult = this.state.savedSearchList.filter(search => {
        return search.isDefault;
      });
      if (defaultResult.length) {
        newState.isDefaultSearch = true;
        newState.searchId = defaultResult[0].id;
        newState.query = defaultResult[0].query;
      } else {
        newState.searchId = null;
      }
    }
    newState.loading = false;
    return newState;
  },

  hasQuery(props) {
    props = props || this.props;
    let currentQuery = props.location.query || {};
    return 'query' in currentQuery;
  },

  fetchData(options = {}) {
    const environment =
      typeof options.environment === 'undefined'
        ? this.props.environment
        : options.environment;

    // Remove leading and trailing whitespace
    let query = streamUtils.formatQueryString(this.state.query);
    let url = this.getGroupListEndpoint();

    this.setState({
      dataLoading: true,
      queryCount: null,
      error: false,
    });

    let envName = environment ? environment.name : null;
    let requestParams = {
      query,
      limit: MAX_ITEMS,
      sort: this.state.sort,
      statsPeriod: this.state.statsPeriod,
      shortIdLookup: '1',
    };

    // Always keep the global active environment in sync with the queried environment
    // The global environment wins unless there one is specified by the saved search
    const queryEnvironment = streamUtils.getQueryEnvironment(query);

    // Always use environment option if it is passed
    if (typeof options.environment !== 'undefined') {
      query = streamUtils.getQueryStringWithEnvironment(query, envName);
      requestParams.query = query;
      requestParams.environment = envName;
      this.setState({
        query,
      });
    } else if (queryEnvironment !== null) {
      // Set the global environment to the one specified by the saved search
      if (queryEnvironment !== envName) {
        let env = EnvironmentStore.getByName(queryEnvironment);
        setActiveEnvironment(env);
      }
      requestParams.environment = queryEnvironment;
    }

    let currentQuery = this.props.location.query || {};
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
          if (data[0].matchingEventId) {
            return void browserHistory.push(
              `/${this.props.params.orgId}/${data[0].project.slug}/issues/${data[0]
                .id}/events/${data[0].matchingEventId}/`
            );
          }
          return void browserHistory.push(
            `/${this.props.params.orgId}/${data[0].project.slug}/issues/${data[0].id}/`
          );
        }

        addIssues(data);

        let queryCount = jqXHR.getResponseHeader('X-Hits');
        let queryMaxCount = jqXHR.getResponseHeader('X-Max-Hits');

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
        let error = err.responseJSON || true;
        error = error.detail || true;
        this.setState({
          error,
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
    let links = parseLinkHeader(this.state.pageLinks);
    if (links && !links.previous.results && this.state.realtimeActive) {
      this._poller.setEndpoint(links.previous.href);
      this._poller.enable();
    }
  },

  getGroupListEndpoint() {
    let params = this.props.params;

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
    // TODO: fix this
    this._streamManager.unshift(data);
    if (!_.isEqual(this.state.pageLinks, links)) {
      this.setState({
        pageLinks: links,
      });
    }
  },

  onSearch(query) {
    if (query === this.state.query) {
      // if query is the same, just re-fetch data
      this.fetchData();
    } else {
      this.setState(
        {
          query,
          searchId: null,
        },
        this.transitionTo
      );
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
    this.setState({
      isSidebarVisible: !this.state.isSidebarVisible,
    });
  },

  /**
   * Returns true if all results in the current query are visible/on this page
   */
  allResultsVisible() {
    if (!this.state.pageLinks) return false;

    let links = parseLinkHeader(this.state.pageLinks);
    return links && !links.previous.results && !links.next.results;
  },

  transitionTo() {
    let queryParams = {};

    if (!this.state.searchId) {
      queryParams.query = this.state.query;
    }

    if (this.state.sort !== DEFAULT_SORT) {
      queryParams.sort = this.state.sort;
    }

    if (this.state.statsPeriod !== DEFAULT_STATS_PERIOD) {
      queryParams.statsPeriod = this.state.statsPeriod;
    }

    let params = this.props.params;

    let path = this.state.searchId
      ? `/${params.orgId}/${params.projectId}/searches/${this.state.searchId}/`
      : `/${params.orgId}/${params.projectId}/`;

    browserHistory.push({
      pathname: path,
      query: queryParams,
    });
  },

  createSampleEvent() {
    let params = this.props.params;
    let url = `/projects/${params.orgId}/${params.projectId}/create-sample/`;
    this.api.request(url, {
      method: 'POST',
      success: data => {
        browserHistory.push(
          `/${params.orgId}/${params.projectId}/issues/${data.groupID}/`
        );
      },
    });
  },

  renderProcessingIssuesHint() {
    let pi = this.state.processingIssues;
    if (!pi || this.showingProcessingIssues()) {
      return null;
    }

    let {orgId, projectId} = this.props.params;
    let link = `/${orgId}/${projectId}/settings/processing-issues/`;
    let showButton = false;
    let className = {
      'processing-issues': true,
      alert: true,
    };
    let issues = null;
    let lastEvent = null;
    let icon = null;

    if (pi.numIssues > 0) {
      icon = <span className="icon icon-alert" />;
      issues = tn(
        'There is %d issue blocking event processing',
        'There are %d issues blocking event processing',
        pi.numIssues
      );
      lastEvent = (
        <span className="last-seen">
          ({tct('last event from [ago]', {
            ago: <TimeSince date={pi.lastSeen} />,
          })})
        </span>
      );
      className['alert-error'] = true;
      showButton = true;
    } else if (pi.issuesProcessing > 0) {
      icon = <span className="icon icon-processing play" />;
      className['alert-info'] = true;
      issues = tn(
        'Reprocessing %d event …',
        'Reprocessing %d events …',
        pi.issuesProcessing
      );
    } else if (pi.resolveableIssues > 0) {
      icon = <span className="icon icon-processing" />;
      className['alert-warning'] = true;
      issues = tn(
        'There is %d event pending reprocessing.',
        'There are %d events pending reprocessing.',
        pi.resolveableIssues
      );
      showButton = true;
    } else {
      /* we should not go here but what do we know */ return null;
    }
    return (
      <div className={classNames(className)}>
        {showButton && (
          <Link to={link} className="btn btn-default btn-sm pull-right">
            {t('Show details')}
          </Link>
        )}
        {icon} <strong>{issues}</strong> {lastEvent}{' '}
      </div>
    );
  },

  renderGroupNodes(ids, statsPeriod) {
    let {orgId, projectId} = this.props.params;
    let groupNodes = ids.map(id => {
      return (
        <StreamGroup
          key={id}
          id={id}
          orgId={orgId}
          projectId={projectId}
          statsPeriod={statsPeriod}
        />
      );
    });
    return <ul className="group-list">{groupNodes}</ul>;
  },

  renderAwaitingEvents() {
    let org = this.props.organization;
    let project = this.props.project;
    let sampleLink = null;
    if (this.props.groupIds.length > 0) {
      let sampleIssueId = this.props.groupIds[0];

      sampleLink = (
        <p>
          <Link to={`/${org.slug}/${project.slug}/issues/${sampleIssueId}/?sample`}>
            {t('Or see your sample event')}
          </Link>
        </p>
      );
    } else {
      sampleLink = (
        <p>
          <a onClick={this.createSampleEvent.bind(this, project.platform)}>
            {t('Create a sample event')}
          </a>
        </p>
      );
    }

    return (
      <div className="box awaiting-events">
        <div className="wrap">
          <div className="robot">
            <span className="eye" />
          </div>
          <h3>{t('Waiting for events…')}</h3>
          <p>
            {tct(
              'Our error robot is waiting to [cross:devour] receive your first event.',
              {
                cross: <span className="strikethrough" />,
              }
            )}
          </p>
          <p>
            <Link
              to={`/${org.slug}/${project.slug}/getting-started/`}
              className="btn btn-primary btn-lg"
            >
              {t('Installation Instructions')}
            </Link>
          </p>
          {sampleLink}
        </div>
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('Sorry, no events match your filters.')}</p>
      </div>
    );
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderStreamBody() {
    let body;
    if (this.state.dataLoading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    } else if (!this.props.project.firstEvent) {
      body = this.renderAwaitingEvents();
    } else if (this.props.groupIds.length > 0) {
      body = this.renderGroupNodes(this.props.groupIds, this.state.statsPeriod);
    } else {
      body = this.renderEmpty();
    }
    return body;
  },

  render() {
    // global loading
    if (this.state.loading || this.props.groupIds === undefined) {
      return this.renderLoading();
    }
    let params = this.props.params;
    let classes = ['stream-row'];
    if (this.state.isSidebarVisible) classes.push('show-sidebar');
    let {orgId, projectId} = this.props.params;
    let searchId = this.state.searchId;
    let access = new Set(this.props.organization.access);
    let projectFeatures = new Set(this.props.project.features);
    return (
      <StickyContainer>
        <div className={classNames(classes)}>
          <div className="stream-content">
            <StreamFilters
              access={access}
              orgId={orgId}
              projectId={projectId}
              query={this.state.query}
              sort={this.state.sort}
              tags={this.props.tags}
              searchId={searchId}
              queryCount={this.state.queryCount}
              queryMaxCount={this.state.queryMaxCount}
              onSortChange={this.onSortChange}
              onSearch={this.onSearch}
              onSavedSearchCreate={this.onSavedSearchCreate}
              onSidebarToggle={this.onSidebarToggle}
              isSearchDisabled={this.state.isSidebarVisible}
              savedSearchList={this.state.savedSearchList}
            />
            <Sticky topOffset={59}>
              {props => (
                <div className={classNames('group-header', {sticky: props.isSticky})}>
                  <StreamActions
                    orgId={params.orgId}
                    projectId={params.projectId}
                    hasReleases={projectFeatures.has('releases')}
                    latestRelease={this.props.project.latestRelease}
                    query={this.state.query}
                    onSelectStatsPeriod={this.onSelectStatsPeriod}
                    onRealtimeChange={this.onRealtimeChange}
                    realtimeActive={this.state.realtimeActive}
                    statsPeriod={this.state.statsPeriod}
                    groupIds={this.props.groupIds}
                    allResultsVisible={this.allResultsVisible()}
                  />
                </div>
              )}
            </Sticky>
            {this.renderProcessingIssuesHint()}
            {this.renderStreamBody()}
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
      </StickyContainer>
    );
  },
});

export default Stream;
