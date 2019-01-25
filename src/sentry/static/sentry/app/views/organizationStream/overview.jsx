import {browserHistory} from 'react-router';
import {isEqual, omit, pickBy, uniq, sortBy} from 'lodash';
import Cookies from 'js-cookie';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import qs from 'query-string';

import {Client} from 'app/api';
import {t} from 'app/locale';
import ErrorRobot from 'app/components/errorRobot';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {extractSelectionParameters} from 'app/components/organizations/globalSelectionHeader/utils';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody} from 'app/components/panels';
import StreamGroup from 'app/components/stream/group';
import {updateProjects} from 'app/actionCreators/globalSelection';
import {fetchProject} from 'app/actionCreators/projects';
import {fetchTags} from 'app/actionCreators/tags';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {fetchSavedSearches} from 'app/actionCreators/savedSearches';
import {fetchProcessingIssues} from 'app/actionCreators/processingIssues';
import ConfigStore from 'app/stores/configStore';
import GroupStore from 'app/stores/groupStore';
import SelectedGroupStore from 'app/stores/selectedGroupStore';
import TagStore from 'app/stores/tagStore';
import EventsChart from 'app/views/organizationEvents/eventsChart';
import SentryTypes from 'app/sentryTypes';
import StreamActions from 'app/views/stream/actions';
import StreamFilters from 'app/views/stream/filters';
import StreamSidebar from 'app/views/stream/sidebar';
import ProcessingIssueHint from 'app/views/stream/processingIssueHint';
import {analytics} from 'app/utils/analytics';
import {getUtcDateString} from 'app/utils/dates';
import {logAjaxError} from 'app/utils/logging';
import parseApiError from 'app/utils/parseApiError';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import utils from 'app/utils';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';

const MAX_ITEMS = 25;
const DEFAULT_QUERY = 'is:unresolved';
const DEFAULT_SORT = 'date';
const DEFAULT_STATS_PERIOD = '24h';
const STATS_PERIODS = new Set(['14d', '24h']);

const OrganizationStream = createReactClass({
  displayName: 'OrganizationStream',

  propTypes: {
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange'),
    Reflux.listenTo(TagStore, 'onTagsChange'),
  ],

  getInitialState() {
    let realtimeActiveCookie = Cookies.get('realtimeActive');
    let realtimeActive =
      typeof realtimeActiveCookie === 'undefined'
        ? false
        : realtimeActiveCookie === 'true';

    return {
      groupIds: [],
      loading: false,
      selectAllActive: false,
      realtimeActive,
      pageLinks: '',
      queryCount: null,
      error: false,
      isSidebarVisible: false,
      savedSearch: null,
      savedSearchList: [],
      processingIssues: null,
      tagsLoading: true,
      memberList: {},
      tags: TagStore.getAllTags(),
      // the project for the selected issues
      // Will only be set if selected issues all belong
      // to one project.
      selectedProject: null,
    };
  },

  componentDidMount() {
    this.api = new Client();
    this._streamManager = new utils.StreamManager(GroupStore);
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll,
    });

    fetchTags(this.props.organization.slug);
    fetchOrgMembers(this.api, this.props.organization.slug).then(members => {
      let memberList = members.reduce((acc, member) => {
        for (let project of member.projects) {
          if (acc[project] === undefined) {
            acc[project] = [];
          }
          acc[project].push(member.user);
        }
        return acc;
      }, {});
      this.setState({memberList});
    });

    // Start by getting searches first so if the user is on a saved search
    // we load the correct data the first time.
    this.fetchSavedSearches();
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
    if (prevProps.params.searchId != this.props.params.searchId) {
      this.onSavedSearchChange();
    } else if (
      prevProps.location.search != this.props.location.search ||
      !isEqual(prevProps.selection, this.props.selection)
    ) {
      this.fetchData();
    }
  },

  componentWillUnmount() {
    this._poller.disable();
    this.projectCache = {};
    GroupStore.reset();
    this.api.clear();
  },

  // Memoize projects fetched as selections are made
  // This data is fed into the action toolbar for release data.
  projectCache: {},

  getQuery() {
    if (this.state.savedSearch) {
      return this.state.savedSearch.query;
    }
    return this.props.location.query.query || DEFAULT_QUERY;
  },

  getSort() {
    return this.props.location.query.sort || DEFAULT_SORT;
  },

  getGroupStatsPeriod() {
    let currentPeriod = this.props.location.query.groupStatsPeriod;
    return STATS_PERIODS.has(currentPeriod) ? currentPeriod : DEFAULT_STATS_PERIOD;
  },

  getEndpointParams() {
    let {selection} = this.props;

    let params = {
      project: selection.projects,
      environment: selection.environments,
      query: this.getQuery(),
      ...selection.datetime,
    };
    if (selection.datetime.period) {
      delete params.period;
      params.statsPeriod = selection.datetime.period;
    }
    if (params.end) {
      params.end = getUtcDateString(params.end);
    }
    if (params.start) {
      params.start = getUtcDateString(params.start);
    }

    let sort = this.getSort();
    if (sort !== DEFAULT_SORT) {
      params.sort = sort;
    }

    let groupStatsPeriod = this.getGroupStatsPeriod();
    if (groupStatsPeriod !== DEFAULT_STATS_PERIOD) {
      params.groupStatsPeriod = groupStatsPeriod;
    }

    // only include defined values.
    return pickBy(params, v => utils.defined(v));
  },

  getAccess() {
    return new Set(this.props.organization.access);
  },

  /**
   * Get the projects that are selected in the global filters
   */
  getGlobalSearchProjects() {
    let {projects} = this.props.selection;
    projects = projects.map(p => p.toString());

    return this.props.organization.projects.filter(p => projects.indexOf(p.id) > -1);
  },

  fetchData() {
    this.fetchProcessingIssues();
    GroupStore.loadInitialData([]);

    this.setState({
      loading: true,
      queryCount: null,
      error: false,
    });

    let requestParams = {
      ...this.getEndpointParams(),
      limit: MAX_ITEMS,
      shortIdLookup: '1',
    };

    let currentQuery = this.props.location.query || {};
    if ('cursor' in currentQuery) {
      requestParams.cursor = currentQuery.cursor;
    }

    if (this.lastRequest) {
      this.lastRequest.cancel();
    }

    this._poller.disable();

    this.lastRequest = this.api.request(this.getGroupListEndpoint(), {
      method: 'GET',
      data: qs.stringify(requestParams),
      success: (data, ignore, jqXHR) => {
        let {orgId} = this.props.params;
        // If this is a direct hit, we redirect to the intended result directly.
        if (jqXHR.getResponseHeader('X-Sentry-Direct-Hit') === '1') {
          let redirect;
          if (data[0] && data[0].matchingEventId) {
            let {id, matchingEventId} = data[0];
            redirect = `/organizations/${orgId}/issues/${id}/events/${matchingEventId}/`;
          } else {
            let {id} = data[0];
            redirect = `/organizations/${orgId}/issues/${id}/`;
          }

          browserHistory.replace({
            pathname: redirect,
            query: extractSelectionParameters(this.props.location.query),
          });
          return;
        }

        this._streamManager.push(data);

        let queryCount = jqXHR.getResponseHeader('X-Hits');
        let queryMaxCount = jqXHR.getResponseHeader('X-Max-Hits');

        this.setState({
          error: false,
          loading: false,
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
          loading: false,
        });
      },
      complete: jqXHR => {
        this.lastRequest = null;

        this.resumePolling();
      },
    });
  },

  fetchProcessingIssues() {
    let {orgId} = this.props.params;
    let projects = this.props.selection.projects;
    fetchProcessingIssues(this.api, orgId, projects).then(
      data => {
        let haveIssues = data.filter(
          p => p.hasIssues || p.resolveableIssues > 0 || p.issuesProcessing > 0
        );

        if (haveIssues.length > 0) {
          this.setState({
            processingIssues: data,
          });
        }
      },
      error => {
        // this is okay. it's just a ui hint
        logAjaxError(error);
      }
    );
  },

  showingProcessingIssues() {
    return this.state.query && this.state.query.trim() == 'is:unprocessed';
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

    return `/organizations/${params.orgId}/issues/`;
  },

  onSavedSearchChange() {
    if (!this.state.savedSearchList) {
      return;
    }

    let {searchId} = this.props.params;
    let match = this.state.savedSearchList.find(search => search.id === searchId);
    if (match) {
      let projects = [];
      if (match.projectId) {
        projects = [parseInt(match.projectId, 10)];
      }

      // Will trigger a transition if the projects changed
      updateProjects(projects);
      this.setState({savedSearch: match}, this.transitionTo);
    } else {
      this.setState({savedSearch: null}, this.transitionTo);
    }
  },

  onRealtimeChange(realtime) {
    Cookies.set('realtimeActive', realtime.toString());
    this.setState({
      realtimeActive: realtime,
    });
  },

  onSelectStatsPeriod(period) {
    if (period != this.getGroupStatsPeriod()) {
      this.transitionTo({groupStatsPeriod: period});
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
    let groupIds = this._streamManager.getAllItems().map(item => item.id);
    if (!isEqual(groupIds, this.state.groupIds)) {
      this.setState({groupIds});
    }
  },

  onSearch(query) {
    if (query === this.state.query) {
      // if query is the same, just re-fetch data
      this.fetchData();
    } else {
      this.transitionTo({query});
    }
  },

  onSortChange(sort) {
    this.transitionTo({sort});
  },

  onTagsChange(tags) {
    // Exclude the environment tag as it lives in global search.
    this.setState({
      tags: omit(tags, 'environment'),
      tagsLoading: false,
    });
  },

  onSidebarToggle() {
    let {organization} = this.props;
    this.setState({
      isSidebarVisible: !this.state.isSidebarVisible,
    });
    analytics('issue.search_sidebar_clicked', {
      org_id: parseInt(organization.id, 10),
    });
  },

  onSelectedGroupChange() {
    let selected = SelectedGroupStore.getSelectedIds();
    let projects = [...selected]
      .map(id => GroupStore.get(id))
      .map(group => group.project.slug);

    let uniqProjects = uniq(projects);

    // we only want selectedProject set if there is 1 project
    // more or fewer should result in a null so that the action toolbar
    // can behave correctly.
    if (uniqProjects.length !== 1) {
      this.setState({selectedProject: null});
      return;
    }
    this.fetchProject(uniqProjects[0]);
  },

  /**
   * Fetch the selected project from the API
   * We need to do this as `props.organization.projects` lacks the `latestRelease` property
   */
  fetchProject(projectSlug) {
    if (projectSlug in this.projectCache) {
      this.setState({selectedProject: this.projectCache[projectSlug]});
      return;
    }

    let orgId = this.props.organization.slug;
    fetchProject(this.api, orgId, projectSlug).then(project => {
      this.projectCache[project.slug] = project;
      this.setState({selectedProject: project});
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

  transitionTo(newParams = {}) {
    let query = {
      ...this.getEndpointParams(),
      ...newParams,
    };
    let {organization} = this.props;
    let {savedSearch} = this.state;
    let path;

    if (savedSearch && query.query == savedSearch.query) {
      path = `/organizations/${organization.slug}/issues/searches/${savedSearch.id}/`;
      // Drop query and add project so we endup in the right place.
      delete query.query;
      if (savedSearch.projectId) {
        query.project = [savedSearch.projectId];
      }
    } else {
      path = `/organizations/${organization.slug}/issues/`;
    }

    if (path !== this.props.location.path && !isEqual(query, this.props.location.query)) {
      browserHistory.push({
        pathname: path,
        query,
      });

      // Refetch data as simply pushing browserHistory doesn't
      // update props.
      this.fetchData();
    }
  },

  renderGroupNodes(ids, groupStatsPeriod) {
    // Restrict this guide to only show for new users (joined<30 days) and add guide anhor only to the first issue
    let userDateJoined = new Date(ConfigStore.get('user').dateJoined);
    let dateCutoff = new Date();
    dateCutoff.setDate(dateCutoff.getDate() - 30);

    let topIssue = ids[0];
    let {memberList} = this.state;

    let {orgId} = this.props.params;
    let groupNodes = ids.map(id => {
      let hasGuideAnchor = userDateJoined > dateCutoff && id === topIssue;

      let group = GroupStore.get(id);
      let members = memberList[group.project.slug] || null;

      return (
        <StreamGroup
          key={id}
          id={id}
          orgId={orgId}
          statsPeriod={groupStatsPeriod}
          query={this.getQuery()}
          hasGuideAnchor={hasGuideAnchor}
          memberList={members}
        />
      );
    });
    return <PanelBody className="ref-group-list">{groupNodes}</PanelBody>;
  },

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no issues match your filters.')}</p>
      </EmptyStateWarning>
    );
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderStreamBody() {
    let body;
    let selectedProjects = this.getGlobalSearchProjects();
    let noEvents = selectedProjects.filter(p => !p.firstEvent).length > 0;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    } else if (this.state.groupIds.length > 0) {
      body = this.renderGroupNodes(this.state.groupIds, this.getGroupStatsPeriod());
    } else if (noEvents) {
      body = this.renderAwaitingEvents(selectedProjects);
    } else {
      body = this.renderEmpty();
    }
    return body;
  },

  fetchSavedSearches() {
    let {orgId} = this.props.params;
    this.setState({loading: true});

    fetchSavedSearches(this.api, orgId).then(
      savedSearchList => {
        this.setState({savedSearchList}, this.onSavedSearchChange);
      },
      error => {
        logAjaxError(error);
      }
    );
  },

  onSavedSearchCreate(data) {
    let savedSearchList = this.state.savedSearchList;

    savedSearchList.push(data);
    this.setState({
      savedSearchList: sortBy(savedSearchList, ['name', 'projectId']),
    });
    this.setState({savedSearch: data}, this.transitionTo);
  },

  renderProcessingIssuesHints() {
    let pi = this.state.processingIssues;
    if (!pi || this.showingProcessingIssues()) {
      return null;
    }
    let {orgId} = this.props.params;
    return pi.map((p, idx) => {
      return (
        <ProcessingIssueHint
          key={idx}
          issue={p}
          projectId={p.project}
          orgId={orgId}
          showProject
        />
      );
    });
  },

  renderAwaitingEvents(projects) {
    let {organization} = this.props;
    let project = projects.length > 0 ? projects[0] : null;

    let sampleIssueId = this.state.groupIds.length > 0 ? this.state.groupIds[0] : '';
    return (
      <ErrorRobot
        org={organization}
        project={project}
        sampleIssueId={sampleIssueId}
        gradient={true}
      />
    );
  },

  render() {
    if (this.state.loading) {
      return this.renderLoading();
    }
    let params = this.props.params;
    let classes = ['stream-row'];
    if (this.state.isSidebarVisible) {
      classes.push('show-sidebar');
    }
    let {orgId, searchId} = this.props.params;
    let access = this.getAccess();
    let query = this.getQuery();

    // If we have a selected project we can get release data
    let hasReleases = false;
    let projectId = null;
    let latestRelease = null;
    let {selectedProject} = this.state;
    if (selectedProject) {
      let features = new Set(selectedProject.features);
      hasReleases = features.has('releases');
      latestRelease = selectedProject.latestRelease;
      projectId = selectedProject.slug;
    } else {
      // If the user has filtered down to a single project
      // we can hint the autocomplete/savedsearch picker with that.
      let projects = this.getGlobalSearchProjects();
      if (projects.length === 1) {
        projectId = projects[0].slug;
      }
    }

    return (
      <div className={classNames(classes)}>
        <div className="stream-content">
          <StreamFilters
            access={access}
            orgId={orgId}
            projectId={projectId}
            searchId={searchId}
            query={query}
            sort={this.getSort()}
            queryCount={this.state.queryCount}
            queryMaxCount={this.state.queryMaxCount}
            onSortChange={this.onSortChange}
            onSearch={this.onSearch}
            onSavedSearchCreate={this.onSavedSearchCreate}
            onSidebarToggle={this.onSidebarToggle}
            isSearchDisabled={this.state.isSidebarVisible}
            savedSearchList={this.state.savedSearchList}
          />

          <Panel>
            <EventsChart query="" organization={this.props.organization} />
          </Panel>

          <Panel>
            <StreamActions
              orgId={params.orgId}
              projectId={projectId}
              hasReleases={hasReleases}
              latestRelease={latestRelease}
              query={query}
              queryCount={this.state.queryCount}
              onSelectStatsPeriod={this.onSelectStatsPeriod}
              onRealtimeChange={this.onRealtimeChange}
              realtimeActive={this.state.realtimeActive}
              statsPeriod={this.getGroupStatsPeriod()}
              groupIds={this.state.groupIds}
              allResultsVisible={this.allResultsVisible()}
            />
            <PanelBody>
              {this.renderProcessingIssuesHints()}
              {this.renderStreamBody()}
            </PanelBody>
          </Panel>
          <Pagination pageLinks={this.state.pageLinks} />
        </div>
        <StreamSidebar
          loading={this.state.tagsLoading}
          tags={this.state.tags}
          query={query}
          onQueryChange={this.onSearch}
          orgId={params.orgId}
        />
      </div>
    );
  },
});

export default withGlobalSelection(withOrganization(OrganizationStream));
export {OrganizationStream};
