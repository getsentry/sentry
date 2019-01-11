import {browserHistory} from 'react-router';
import {omit, pickBy} from 'lodash';
import Cookies from 'js-cookie';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import qs from 'query-string';

import {Panel, PanelBody} from 'app/components/panels';
import {analytics} from 'app/utils/analytics';
import {t, tct} from 'app/locale';
import {fetchTags} from 'app/actionCreators/tags';
import ApiMixin from 'app/mixins/apiMixin';
import ConfigStore from 'app/stores/configStore';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import GroupStore from 'app/stores/groupStore';
import TagStore from 'app/stores/tagStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import StreamGroup from 'app/components/stream/group';
import StreamFilters from 'app/views/stream/filters';
import StreamSidebar from 'app/views/stream/sidebar';
import parseApiError from 'app/utils/parseApiError';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import utils from 'app/utils';
import withOrganization from 'app/utils/withOrganization';

const MAX_ITEMS = 25;
const DEFAULT_SORT = 'date';
const DEFAULT_STATS_PERIOD = '24h';
const STATS_PERIODS = new Set(['14d', '24h']);

const OrganizationStream = createReactClass({
  displayName: 'OrganizationStream',

  propTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [
    Reflux.listenTo(GlobalSelectionStore, 'onSelectionChange'),
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    Reflux.listenTo(TagStore, 'onTagsChange'),
    ApiMixin,
  ],

  getInitialState() {
    let realtimeActiveCookie = Cookies.get('realtimeActive');
    let realtimeActive =
      typeof realtimeActiveCookie === 'undefined'
        ? false
        : realtimeActiveCookie === 'true';

    let currentQuery = this.props.location.query || {};
    let sort = 'sort' in currentQuery ? currentQuery.sort : DEFAULT_SORT;

    let groupStatsPeriod = STATS_PERIODS.has(currentQuery.groupStatsPeriod)
      ? currentQuery.groupStatsPeriod
      : DEFAULT_STATS_PERIOD;

    return {
      groupIds: [],
      isDefaultSearch: false,
      loading: false,
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      groupStatsPeriod,
      realtimeActive,
      pageLinks: '',
      queryCount: null,
      error: false,
      query: currentQuery.query || '',
      sort,
      selection: GlobalSelectionStore.get(),
      isSidebarVisible: false,
      savedSearchList: [],
      processingIssues: null,
      tagsLoading: true,
      tags: TagStore.getAllTags(),
    };
  },

  componentWillMount() {
    this._streamManager = new utils.StreamManager(GroupStore);
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll,
    });

    if (!this.state.loading) {
      this.fetchData();
      fetchTags(this.props.organization.slug);
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

  getQueryParams() {
    let selection = this.state.selection;
    let params = {
      project: selection.projects,
      environment: selection.environments,
      query: this.state.query,
      ...selection.datetime,
    };
    if (selection.datetime.period) {
      delete params.period;
      params.statsPeriod = selection.datetime.period;
    }

    if (this.state.sort !== DEFAULT_SORT) {
      params.sort = this.state.sort;
    }

    if (this.state.groupStatsPeriod !== DEFAULT_STATS_PERIOD) {
      params.groupStatsPeriod = this.state.groupStatsPeriod;
    }

    // only include defined values.
    return pickBy(params, v => utils.defined(v));
  },

  getAccess() {
    return new Set(this.props.organization.access);
  },

  fetchData() {
    GroupStore.loadInitialData([]);

    this.setState({
      loading: true,
      queryCount: null,
      error: false,
    });

    let url = this.getGroupListEndpoint();
    let requestParams = {
      ...this.getQueryParams(),
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

    this.lastRequest = this.api.request(url, {
      method: 'GET',
      data: qs.stringify(requestParams),
      success: (data, ignore, jqXHR) => {
        // if this is a direct hit, we redirect to the intended result directly.
        // we have to use the project slug from the result data instead of the
        // the current props one as the shortIdLookup can return results for
        // different projects.
        if (jqXHR.getResponseHeader('X-Sentry-Direct-Hit') === '1') {
          if (data && data[0].matchingEventId) {
            let {project, id, matchingEventId} = data[0];
            let redirect = `/${this.props.params
              .orgId}/${project.slug}/issues/${id}/events/${matchingEventId}/`;

            // TODO set environment for the requested issue.
            browserHistory.replace(redirect);
            return;
          }
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

  onRealtimeChange(realtime) {
    Cookies.set('realtimeActive', realtime.toString());
    this.setState({
      realtimeActive: realtime,
    });
  },

  onSelectStatsPeriod(period) {
    if (period != this.state.groupStatsPeriod) {
      // TODO(dcramer): all charts should now suggest "loading"
      this.setState(
        {
          groupStatsPeriod: period,
        },
        this.transitionTo
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
    let groupIds = this._streamManager.getAllItems().map(item => item.id);
    if (!utils.valueIsEqual(groupIds, this.state.groupIds)) {
      this.setState({
        groupIds,
      });
    }
  },

  onSelectionChange(selection) {
    this.setState({selection}, this.transitionTo);
  },

  onSearch(query) {
    if (query === this.state.query) {
      // if query is the same, just re-fetch data
      this.fetchData();
    } else {
      this.setState(
        {
          query,
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

  /**
   * Returns true if all results in the current query are visible/on this page
   */
  allResultsVisible() {
    if (!this.state.pageLinks) return false;

    let links = parseLinkHeader(this.state.pageLinks);
    return links && !links.previous.results && !links.next.results;
  },

  transitionTo() {
    let query = this.getQueryParams();
    let {organization} = this.props;

    let path = `/organizations/${organization.slug}/issues/`;
    browserHistory.push({
      pathname: path,
      query,
    });

    // After transitioning reload data. This is simpler and less
    // error prone than examining router state in componentWillReceiveProps
    this.fetchData();
  },

  renderGroupNodes(ids, groupStatsPeriod) {
    // Restrict this guide to only show for new users (joined<30 days) and add guide anhor only to the first issue
    let userDateJoined = new Date(ConfigStore.get('user').dateJoined);
    let dateCutoff = new Date();
    dateCutoff.setDate(dateCutoff.getDate() - 30);

    let topIssue = ids[0];

    let {orgId} = this.props.params;
    let groupNodes = ids.map(id => {
      let hasGuideAnchor = userDateJoined > dateCutoff && id === topIssue;
      return (
        <StreamGroup
          key={id}
          id={id}
          orgId={orgId}
          statsPeriod={groupStatsPeriod}
          query={this.state.query}
          hasGuideAnchor={hasGuideAnchor}
        />
      );
    });
    return <PanelBody className="ref-group-list">{groupNodes}</PanelBody>;
  },

  renderEmpty() {
    const {environment} = this.state;
    const message = environment
      ? tct('Sorry no events match your filters in the [env] environment.', {
          env: environment.displayName,
        })
      : t('Sorry, no events match your filters.');

    // TODO(lyn): Extract empty state to a separate component
    return (
      <div className="empty-stream" style={{border: 0}}>
        <span className="icon icon-exclamation" />
        <p>{message}</p>
      </div>
    );
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderStreamBody() {
    let body;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    } else if (this.state.groupIds.length > 0) {
      body = this.renderGroupNodes(this.state.groupIds, this.state.groupStatsPeriod);
    } else {
      body = this.renderEmpty();
    }
    return body;
  },

  onSavedSearchCreate() {
    // TODO implement
  },

  render() {
    // global loading
    if (this.state.loading) {
      return this.renderLoading();
    }
    let params = this.props.params;
    let classes = ['stream-row'];
    if (this.state.isSidebarVisible) classes.push('show-sidebar');
    let {orgId} = this.props.params;
    let access = this.getAccess();

    // In the project mode this reads from the project feature.
    // There is no analogous property for organizations yet.
    let hasReleases = false;
    let latestRelease = '';

    return (
      <div className={classNames(classes)}>
        <div className="stream-content">
          <StreamFilters
            access={access}
            orgId={orgId}
            query={this.state.query}
            sort={this.state.sort}
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
            <StreamActions
              orgId={params.orgId}
              hasReleases={hasReleases}
              latestRelease={latestRelease}
              environment={this.state.environment}
              query={this.state.query}
              queryCount={this.state.queryCount}
              onSelectStatsPeriod={this.onSelectStatsPeriod}
              onRealtimeChange={this.onRealtimeChange}
              realtimeActive={this.state.realtimeActive}
              statsPeriod={this.state.groupStatsPeriod}
              groupIds={this.state.groupIds}
              allResultsVisible={this.allResultsVisible()}
            />
            <PanelBody>{this.renderStreamBody()}</PanelBody>
          </Panel>
          <Pagination pageLinks={this.state.pageLinks} />
        </div>
        <StreamSidebar
          loading={this.state.tagsLoading}
          tags={this.state.tags}
          query={this.state.query}
          onQueryChange={this.onSearch}
          orgId={params.orgId}
        />
      </div>
    );
  },
});

// Placeholder components to keep pull requests manageable.
const StreamActions = props => <p>Stream actions are coming soon</p>;

export default withOrganization(OrganizationStream);
export {OrganizationStream};
