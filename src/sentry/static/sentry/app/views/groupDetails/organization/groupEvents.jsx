import {browserHistory} from 'react-router';
import React from 'react';
import createReactClass from 'create-react-class';
import {pick} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventsTable from 'app/components/eventsTable/eventsTable';
import OrganizationState from 'app/mixins/organizationState';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import parseApiError from 'app/utils/parseApiError';

const GroupEvents = createReactClass({
  displayName: 'GroupEvents',

  propTypes: {
    group: SentryTypes.Group.isRequired,
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    const queryParams = this.props.location.query;

    const initialState = {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: queryParams.query || '',
    };

    return initialState;
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.location.search !== nextProps.location.search) {
      const queryParams = nextProps.location.query;

      this.setState(
        {
          query: queryParams.query,
        },
        this.fetchData
      );
    }
  },

  handleSearch(query) {
    const targetQueryParams = {...this.props.location.query};
    targetQueryParams.query = query;
    const {groupId, orgId} = this.props.params;

    browserHistory.push({
      pathname: `/organizations/${orgId}/issues/${groupId}/events/`,
      query: targetQueryParams,
    });
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const query = {
      ...pick(this.props.location.query, ['cursor', 'environment']),
      limit: 50,
      query: this.state.query,
    };

    this.api.request(`/issues/${this.props.params.groupId}/events/`, {
      query,
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          eventList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: err => {
        this.setState({
          error: parseApiError(err),
          loading: false,
        });
      },
    });
  },

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no events match your search query.')}</p>
      </EmptyStateWarning>
    );
  },

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t("There don't seem to be any events yet.")}</p>
      </EmptyStateWarning>
    );
  },

  renderResults() {
    const group = this.props.group;
    const tagList = group.tags.filter(tag => tag.key !== 'user') || [];

    return (
      <EventsTable
        tagList={tagList}
        events={this.state.eventList}
        params={this.props.params}
      />
    );
  },

  renderBody() {
    let body;

    if (this.state.loading) {
      body = <LoadingIndicator />;
    } else if (this.state.error) {
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    } else if (this.state.eventList.length > 0) {
      body = this.renderResults();
    } else if (this.state.query && this.state.query !== '') {
      body = this.renderNoQueryResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  },

  render() {
    return (
      <div>
        <div style={{marginBottom: 20}}>
          <SearchBar
            defaultQuery=""
            placeholder={t('search event id, message, or tags')}
            query={this.state.query}
            onSearch={this.handleSearch}
          />
        </div>
        <Panel className="event-list">
          <PanelBody>{this.renderBody()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },
});

export default GroupEvents;
