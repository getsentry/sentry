import React from 'react';
import Reflux from 'reflux';
import {History} from 'react-router';
import Cookies from 'js-cookie';
import Sticky from 'react-sticky';
import classNames from 'classnames';
import _ from 'underscore';

import api from '../api';

import GroupStore from '../stores/groupStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import StreamGroup from '../components/stream/group';
import StreamActions from './stream/actions';
import StreamTagActions from '../actions/streamTagActions';
import StreamTagStore from '../stores/streamTagStore';
import StreamFilters from './stream/filters';
import StreamSidebar from './stream/sidebar';
import utils from '../utils';
import parseLinkHeader from '../utils/parseLinkHeader';

const Stream = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    Reflux.listenTo(StreamTagStore, 'onStreamTagChange'),
    History
  ],

  getDefaultProps() {
    return {
      // intentional trailing whitespace / better UX for when uesrs focus on search input
      defaultQuery: 'is:unresolved ',

      defaultSort: 'date',
      defaultStatsPeriod: '24h',
      maxItems: 25
    };
  },

  getInitialState() {
    return {
      groupIds: [],
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod: this.props.defaultStatsPeriod,
      realtimeActive: false,
      pageLinks: '',
      loading: true,
      error: false,
      query: this.props.defaultQuery,
      sort: this.props.defaultSort,
      filter: {},
      tags: StreamTagStore.getAllTags(),
      tagsLoading: true,
      isSidebarVisible: false,
      isStickyHeader: false,
      ...this.getQueryStringState()
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');

    this._streamManager = new utils.StreamManager(GroupStore);
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll,
      endpoint: this.getGroupListEndpoint()
    });

    let realtime = Cookies.get('realtimeActive');
    if (realtime) {
      let realtimeActive = realtime === 'true';
      this.setState({
        realtimeActive: realtimeActive
      });
      if (realtimeActive) {
        this._poller.enable();
      }
    }

    this.fetchTags();
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
      this.setState(this.getQueryStringState(nextProps), this.fetchData);
      this._poller.disable();
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(this.state, nextState, true);
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevState.realtimeActive !== this.state.realtimeActive) {
      if (this.state.realtimeActive) {
        this._poller.enable();
      } else {
        this._poller.disable();
      }
    }
  },

  componentWillUnmount() {
    this._poller.disable();
    GroupStore.reset();
  },

  fetchTags() {
    StreamTagStore.reset();
    StreamTagActions.loadTags();

    this.setState({
      tagsLoading: true
    });

    let params = this.props.params;
    api.request(`/projects/${params.orgId}/${params.projectId}/tags/`, {
      success: (tags) => {
        this.setState({tagsLoading: false});
        StreamTagActions.loadTagsSuccess(tags);
      },
      error: (error) => {
        this.setState({tagsLoading: false});
        StreamTagActions.loadTagsError();
      }
    });
  },

  getQueryStringState(props) {
    props = props || this.props;
    let currentQuery = props.location.query;

    let filter = {};
    if (currentQuery.bookmarks) {
      filter = { bookmarks: '1' };
    } else if (currentQuery.assigned) {
      filter = { assigned: '1' };
    }

    let query =
      currentQuery.hasOwnProperty('query') ?
      currentQuery.query :
      this.props.defaultQuery;

    let sort =
      currentQuery.hasOwnProperty('sort') ?
      currentQuery.sort :
      this.props.defaultSort;

    let statsPeriod =
      currentQuery.hasOwnProperty('statsPeriod') ?
      currentQuery.statsPeriod :
      this.props.defaultStatsPeriod;

    if (statsPeriod !== '14d' && statsPeriod !== '24h') {
      statsPeriod = this.props.defaultStatsPeriod;
    }

    return {
      filter: filter,
      query: query,
      sort: sort,
      statsPeriod: statsPeriod
    };
  },

  fetchData() {
    GroupStore.loadInitialData([]);

    this.setState({
      loading: true,
      error: false
    });

    let url = this.getGroupListEndpoint();

    let requestParams = {
      ...this.props.location.query,
      limit: this.props.maxItems,
      statsPeriod: this.state.statsPeriod
    };

    if (!requestParams.hasOwnProperty('query')) {
      requestParams.query = this.props.defaultQuery;
    }

    if (this.lastRequest) {
      this.lastRequest.cancel();
    }

    this.lastRequest = api.request(url, {
      method: 'GET',
      data: requestParams,
      success: (data, ignore, jqXHR) => {
        // Was this the result of an event SHA search? If so, redirect
        // to corresponding group details
        if (data.length === 1 && /^[a-zA-Z0-9]{32}$/.test(requestParams.query.trim())) {
          let params = this.props.params;
          let groupId = data[0].id;

          return void this.history.pushState(null, `/${params.orgId}/${params.projectId}/group/${groupId}/`);
        }

        this._streamManager.push(data);

        this.setState({
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      },
      complete: (jqXHR) => {
        this.lastRequest = null;

        let links = parseLinkHeader(jqXHR.getResponseHeader('Link'));
        if (links && links.previous) {
          this._poller.setEndpoint(links.previous.href);
        }
      }
    });
  },

  getGroupListEndpoint() {
    let params = this.props.params;

    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/';
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
      this.setState({
        statsPeriod: period
      }, function() {
        this.transitionTo();
      });
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
    let groupIds = this._streamManager.getAllItems().map((item) => item.id);
    if (!utils.valueIsEqual(groupIds, this.state.groupIds)) {
      this.setState({
        groupIds: groupIds
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
    this.setState({
      query: query
    }, this.transitionTo);
  },

  onSortChange(sort) {
    this.setState({
      sort: sort
    }, this.transitionTo);
  },

  onFilterChange(filter) {
    this.setState({
      filter: filter
    }, this.transitionTo);
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

  transitionTo() {
    let queryParams = {};

    for (let prop in this.state.filter) {
      queryParams[prop] = this.state.filter[prop];
    }

    if (this.state.query !== this.props.defaultQuery) {
      queryParams.query = this.state.query;
    }

    if (this.state.sort !== this.props.defaultSort) {
      queryParams.sort = this.state.sort;
    }

    if (this.state.statsPeriod !== this.props.defaultStatsPeriod) {
      queryParams.statsPeriod = this.state.statsPeriod;
    }

    let params = this.props.params;
    this.history.pushState(null, `/${params.orgId}/${params.projectId}/`, queryParams);
  },

  renderGroupNodes(ids, statsPeriod) {
    let {orgId, projectId} = this.props.params;
    let groupNodes = ids.map((id) => {
      return (
        <StreamGroup
          key={id}
          id={id}
          orgId={orgId}
          projectId={projectId}
          statsPeriod={statsPeriod} />
      );
    });

    return (<ul className="group-list" ref="groupList">{groupNodes}</ul>);
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation"></span>
        <p>Sorry, no events match your filters.</p>
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

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = (<LoadingError onRetry={this.fetchData} />);
    } else if (this.state.groupIds.length > 0) {
      body = this.renderGroupNodes(this.state.groupIds, this.state.statsPeriod);
    } else {
      body = this.renderEmpty();
    }

    return body;
  },

  render() {
    let params = this.props.params;

    let classes = ['stream-row'];
    if (this.state.isSidebarVisible)
      classes.push('show-sidebar');

    let {orgId, projectId} = this.props.params;
    return (
      <div className={classNames(classes)}>
        <div className="stream-content">
          <StreamFilters
            orgId={orgId}
            projectId={projectId}
            query={this.state.query}
            sort={this.state.sort}
            tags={this.state.tags}
            defaultQuery={this.props.defaultQuery}
            onSortChange={this.onSortChange}
            onFilterChange={this.onFilterChange}
            onSearch={this.onSearch}
            onSidebarToggle={this.onSidebarToggle}
            isSearchDisabled={this.state.isSidebarVisible}
          />
          <div className="group-header">
            <Sticky onStickyStateChange={this.onStickyStateChange}>
              <div className={this.state.isStickyHeader ? 'container' : null}>
                <StreamActions
                  orgId={params.orgId}
                  projectId={params.projectId}
                  onSelectStatsPeriod={this.onSelectStatsPeriod}
                  onRealtimeChange={this.onRealtimeChange}
                  realtimeActive={this.state.realtimeActive}
                  statsPeriod={this.state.statsPeriod}
                  groupIds={this.state.groupIds} />
              </div>
            </Sticky>
          </div>
          {this.renderStreamBody()}
          <Pagination pageLinks={this.state.pageLinks}/>
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
    );
  }

});

export default Stream;
