import PropTypes from 'prop-types';
import {browserHistory} from 'react-router';
import React from 'react';
import pick from 'lodash/pick';

import SentryTypes from 'app/sentryTypes';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventsTable from 'app/components/eventsTable/eventsTable';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import parseApiError from 'app/utils/parseApiError';

class GroupEvents extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    group: SentryTypes.Group.isRequired,
  };

  constructor(props) {
    super(props);

    const queryParams = this.props.location.query;
    this.state = {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: queryParams.query || '',
    };
  }

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.location.search !== nextProps.location.search) {
      const queryParams = nextProps.location.query;

      this.setState(
        {
          query: queryParams.query,
        },
        this.fetchData
      );
    }
  }

  handleSearch = query => {
    const targetQueryParams = {...this.props.location.query};
    targetQueryParams.query = query;
    const {groupId, orgId} = this.props.params;

    browserHistory.push({
      pathname: `/organizations/${orgId}/issues/${groupId}/events/`,
      query: targetQueryParams,
    });
  };

  fetchData = () => {
    this.setState({
      loading: true,
      error: false,
    });

    const query = {
      ...pick(this.props.location.query, ['cursor', 'environment']),
      limit: 50,
      query: this.state.query,
    };

    this.props.api.request(`/issues/${this.props.params.groupId}/events/`, {
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
  };

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no events match your search query.')}</p>
      </EmptyStateWarning>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t("There don't seem to be any events yet.")}</p>
      </EmptyStateWarning>
    );
  }

  renderResults() {
    const {group, params} = this.props;
    const tagList = group.tags.filter(tag => tag.key !== 'user') || [];

    return (
      <EventsTable
        tagList={tagList}
        events={this.state.eventList}
        orgId={params.orgId}
        projectId={group.project.slug}
        groupId={params.groupId}
      />
    );
  }

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
  }

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
  }
}

export {GroupEvents};

export default withApi(GroupEvents);
