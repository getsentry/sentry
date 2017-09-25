import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import {Link, browserHistory} from 'react-router';
import Cookies from 'js-cookie';
import {StickyContainer, Sticky} from 'react-sticky';
import classNames from 'classnames';
import _ from 'lodash';

import ApiMixin from '../mixins/apiMixin';
import GroupStore from '../stores/groupStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ProjectState from '../mixins/projectState';
import Pagination from '../components/pagination';
import StreamGroup from '../components/stream/group';
import StreamActions from './stream/actions';
import StreamTagActions from '../actions/streamTagActions';
import StreamTagStore from '../stores/streamTagStore';
import StreamFilters from './stream/filters';
import StreamSidebar from './stream/sidebar';
import TimeSince from '../components/timeSince';
import utils from '../utils';
import {logAjaxError} from '../utils/logging';
import parseLinkHeader from '../utils/parseLinkHeader';
import {t, tn, tct} from '../locale';

const Stream = React.createClass({
  propTypes: {
    defaultSort: PropTypes.string,
    defaultStatsPeriod: PropTypes.string,
    defaultQuery: PropTypes.string,
    maxItems: PropTypes.number,
    setProjectNavSection: PropTypes.func
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    Reflux.listenTo(StreamTagStore, 'onStreamTagChange'),
    ApiMixin,
    ProjectState
  ],

  getDefaultProps() {
    return {
      defaultQuery: null,
      defaultSort: 'date',
      defaultStatsPeriod: '24h',
      maxItems: 25
    };
  },

  getInitialState() {
    let searchId = this.props.params.searchId || null;
    let project = this.getProject();
    let realtimeActiveCookie = Cookies.get('realtimeActive');
    let realtimeActive = typeof realtimeActiveCookie === 'undefined'
      ? project && !project.firstEvent
      : realtimeActiveCookie === 'true';

    return {
      groupIds: [],
      isDefaultSearch: null,
      searchId,
      // if we have no query then we can go ahead and fetch data
      loading: searchId || !this.hasQuery() ? true : false,
      savedSearchLoading: true,
      savedSearchList: [],
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod: this.props.defaultStatsPeriod,
      realtimeActive,
      pageLinks: '',
      queryCount: null,
      dataLoading: true,
      error: false,
      query: '',
      sort: this.props.defaultSort,
      tags: StreamTagStore.getAllTags(),
      tagsLoading: true,
      isSidebarVisible: false,
      isStickyHeader: false,
      processingIssues: null,
      ...this.getQueryState()
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');

    this._streamManager = new utils.StreamManager(GroupStore);
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll
    });

    this.fetchSavedSearches();
    this.fetchProcessingIssues();
    this.fetchTags();
  },

  componentWillReceiveProps(nextProps) {
    // you cannot apply both a query and a saved search (our routes do not
    // support it), so the searchId takes priority
    if (this.state.loading) {
      return;
    }

    this.fetchData();

    let searchIdChanged = this.state.isDefaultSearch
      ? nextProps.params.searchId
      : nextProps.params.searchId !== this.state.searchId;

    if (searchIdChanged || nextProps.location.search !== this.props.location.search) {
      // TODO(dcramer): handle 404 from popState on searchId
      this.setState(this.getQueryState(nextProps), this.fetchData);
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(this.state, nextState, true);
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
      savedSearchLoading: true
    });

    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/searches/`, {
      success: data => {
        let newState = {
          isDefaultSearch: false,
          savedSearchLoading: false,
          savedSearchList: data,
          loading: false
        };
        let needsData = this.state.loading;
        let searchId = this.state.searchId;
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
                isDefaultSearch: true
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
          query: ''
        });
      }
    });
  },

  fetchProcessingIssues() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/processingissues/`, {
      success: data => {
        if (data.hasIssues || data.resolveableIssues > 0 || data.issuesProcessing > 0) {
          this.setState({
            processingIssues: data
          });
        }
      },
      error: error => {
        logAjaxError(error);
        // this is okay. it's just a ui hint
      }
    });
  },

  fetchTags() {
    StreamTagStore.reset();
    StreamTagActions.loadTags();

    this.setState({
      tagsLoading: true
    });

    let params = this.props.params;
    this.api.request(`/projects/${params.orgId}/${params.projectId}/tags/`, {
      success: tags => {
        this.setState({tagsLoading: false});
        StreamTagActions.loadTagsSuccess(tags);
      },
      error: error => {
        this.setState({tagsLoading: false});
        StreamTagActions.loadTagsError();
      }
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
      savedSearchList
    });
    browserHistory.pushState(null, `/${orgId}/${projectId}/searches/${data.id}/`);
  },

  getQueryState(props) {
    props = props || this.props;
    let currentQuery = props.location.query || {};
    // state may not yet be defined at this point
    let state = this.state || {};

    let hasQuery = currentQuery.hasOwnProperty('query');

    let searchId = hasQuery ? null : props.params.searchId || state.searchId || null;

    let sort = currentQuery.hasOwnProperty('sort')
      ? currentQuery.sort
      : this.props.defaultSort;

    let statsPeriod = currentQuery.hasOwnProperty('statsPeriod')
      ? currentQuery.statsPeriod
      : this.props.defaultStatsPeriod;

    if (statsPeriod !== '14d' && statsPeriod !== '24h') {
      statsPeriod = this.props.defaultStatsPeriod;
    }

    let newState = {
      sort,
      statsPeriod,
      query: hasQuery ? currentQuery.query : '',
      searchId,
      isDefaultSearch: false
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
    return currentQuery.hasOwnProperty('query');
  },

  fetchData() {
    GroupStore.loadInitialData([]);

    this.setState({
      dataLoading: true,
      queryCount: null,
      error: false
    });

    let url = this.getGroupListEndpoint();

    let requestParams = {
      query: this.state.query.replace(/^\s+|\s+$/g, ''),
      limit: this.props.maxItems,
      sort: this.state.sort,
      statsPeriod: this.state.statsPeriod,
      shortIdLookup: '1'
    };

    let currentQuery = this.props.location.query || {};
    if (currentQuery.hasOwnProperty('cursor')) {
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
            return void browserHistory.pushState(
              null,
              `/${this.props.params.orgId}/${data[0].project.slug}/issues/${data[0].id}/events/${data[0].matchingEventId}/`
            );
          }
          return void browserHistory.pushState(
            null,
            `/${this.props.params.orgId}/${data[0].project.slug}/issues/${data[0].id}/`
          );
        }

        this._streamManager.push(data);

        let queryCount = jqXHR.getResponseHeader('X-Hits');
        let queryMaxCount = jqXHR.getResponseHeader('X-Max-Hits');

        return void this.setState({
          error: false,
          dataLoading: false,
          queryCount: typeof queryCount !== 'undefined'
            ? parseInt(queryCount, 10) || 0
            : 0,
          queryMaxCount: typeof queryMaxCount !== 'undefined'
            ? parseInt(queryMaxCount, 10) || 0
            : 0,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: err => {
        let error = err.responseJSON || true;
        error = error.detail || true;
        this.setState({
          error,
          dataLoading: false
        });
      },
      complete: jqXHR => {
        this.lastRequest = null;

        this.resumePolling();
      }
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
      realtimeActive: realtime
    });
  },

  onSelectStatsPeriod(period) {
    if (period != this.state.statsPeriod) {
      // TODO(dcramer): all charts should now suggest "loading"
      this.setState(
        {
          statsPeriod: period
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
        pageLinks: links
      });
    }
  },

  onGroupChange() {
    let groupIds = this._streamManager.getAllItems().map(item => item.id);
    if (!utils.valueIsEqual(groupIds, this.state.groupIds)) {
      this.setState({
        groupIds
      });
    }
  },

  onStreamTagChange(tags) {
    // new object to trigger state change
    this.setState({
      tags: {...tags}
    });
  },

  onSearch(query) {
    if (query === this.state.query) {
      // if query is the same, just re-fetch data
      this.fetchData();
    } else {
      this.setState(
        {
          query,
          searchId: null
        },
        this.transitionTo
      );
    }
  },

  onSortChange(sort) {
    this.setState(
      {
        sort
      },
      this.transitionTo
    );
  },

  onSidebarToggle() {
    this.setState({
      isSidebarVisible: !this.state.isSidebarVisible
    });
  },

  onStickyStateChange(state) {
    this.setState({
      isStickyHeader: state
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

    if (!this.state.searchId && this.state.query !== this.props.defaultQuery) {
      queryParams.query = this.state.query;
    }

    if (this.state.sort !== this.props.defaultSort) {
      queryParams.sort = this.state.sort;
    }

    if (this.state.statsPeriod !== this.props.defaultStatsPeriod) {
      queryParams.statsPeriod = this.state.statsPeriod;
    }

    let params = this.props.params;
    let path = this.state.searchId
      ? `/${params.orgId}/${params.projectId}/searches/${this.state.searchId}/`
      : `/${params.orgId}/${params.projectId}/`;

    browserHistory.pushState(null, path, queryParams);
  },

  createSampleEvent() {
    let params = this.props.params;
    let url = `/projects/${params.orgId}/${params.projectId}/create-sample/`;
    this.api.request(url, {
      method: 'POST',
      success: data => {
        browserHistory.pushState(
          null,
          `/${params.orgId}/${params.projectId}/issues/${data.groupID}/`
        );
      }
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
      alert: true
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
            ago: <TimeSince date={pi.lastSeen} />
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
        {showButton &&
          <Link to={link} className="btn btn-default btn-sm pull-right">
            {t('Show details')}
          </Link>}
        {icon}
        {' '}
        <strong>{issues}</strong>
        {' '}
        {lastEvent}
        {' '}
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
    return <ul className="group-list" ref="groupList">{groupNodes}</ul>;
  },
  renderAwaitingEvents() {
    let org = this.getOrganization();
    let project = this.getProject();
    let sampleLink = null;
    if (this.state.groupIds.length > 0) {
      let sampleIssueId = this.state.groupIds[0];

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
          <div className="robot"><span className="eye" /></div>
          <h3>{t('Waiting for events…')}</h3>
          <p>
            {tct(
              'Our error robot is waiting to [cross:devour] receive your first event.',
              {
                cross: <span className="strikethrough" />
              }
            )}
          </p>
          <p>
            <Link
              to={`/${org.slug}/${project.slug}/getting-started/`}
              className="btn btn-primary btn-lg">
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
    let project = this.getProject();
    if (this.state.dataLoading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    } else if (!project.firstEvent) {
      body = this.renderAwaitingEvents();
    } else if (this.state.groupIds.length > 0) {
      body = this.renderGroupNodes(this.state.groupIds, this.state.statsPeriod);
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
    let params = this.props.params;
    let classes = ['stream-row'];
    if (this.state.isSidebarVisible) classes.push('show-sidebar');
    let {orgId, projectId} = this.props.params;
    let searchId = this.state.searchId;
    let access = this.getAccess();
    let projectFeatures = this.getProjectFeatures();
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
              tags={this.state.tags}
              searchId={searchId}
              queryCount={this.state.queryCount}
              queryMaxCount={this.state.queryMaxCount}
              defaultQuery={this.props.defaultQuery}
              onSortChange={this.onSortChange}
              onSearch={this.onSearch}
              onSavedSearchCreate={this.onSavedSearchCreate}
              onSidebarToggle={this.onSidebarToggle}
              isSearchDisabled={this.state.isSidebarVisible}
              savedSearchList={this.state.savedSearchList}
            />
            <Sticky onStickyStateChange={this.onStickyStateChange}>
              <div className="group-header">
                <div className={this.state.isStickyHeader ? 'container' : null}>
                  <StreamActions
                    orgId={params.orgId}
                    projectId={params.projectId}
                    hasReleases={projectFeatures.has('releases')}
                    latestRelease={this.context.project.latestRelease}
                    query={this.state.query}
                    onSelectStatsPeriod={this.onSelectStatsPeriod}
                    onRealtimeChange={this.onRealtimeChange}
                    realtimeActive={this.state.realtimeActive}
                    statsPeriod={this.state.statsPeriod}
                    groupIds={this.state.groupIds}
                    allResultsVisible={this.allResultsVisible()}
                  />
                </div>
              </div>
            </Sticky>
            {this.renderProcessingIssuesHint()}
            {this.renderStreamBody()}
            <Pagination pageLinks={this.state.pageLinks} />
          </div>
          <StreamSidebar
            loading={this.state.tagsLoading}
            tags={this.state.tags}
            query={this.state.query}
            onQueryChange={this.onSearch}
            orgId={params.orgId}
            projectId={params.projectId}
          />
        </div>
      </StickyContainer>
    );
  }
});
export default Stream;
