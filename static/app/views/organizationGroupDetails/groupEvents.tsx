import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {Client} from 'sentry/api';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import EventSearchBar from 'sentry/components/events/searchBar';
import EventsTable from 'sentry/components/eventsTable/eventsTable';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, IssueCategory, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import parseApiError from 'sentry/utils/parseApiError';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import AllEventsTable from './allEventsTable';

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
} & RouteComponentProps<{groupId: string; orgId: string}, {}>;

type State = {
  error: string | false;
  eventList: Event[];
  loading: boolean;
  pageLinks: string;
  query: string;
  renderNewAllEventsTab: boolean;
};

const excludedTags = ['environment', 'issue', 'issue.id', 'performance.issues_ids'];

class GroupEvents extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const queryParams = this.props.location.query;
    const renderNewAllEventsTab =
      !!this.props.group.id &&
      this.props.organization.features.includes('performance-issues-all-events-tab');

    this.state = {
      eventList: [],
      loading: true,
      error: false,
      pageLinks: '',
      query: queryParams.query || '',
      renderNewAllEventsTab,
    };
  }

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
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

  handleSearch = (query: string) => {
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

    if (!this.state.renderNewAllEventsTab) {
      this.props.api.request(`/issues/${this.props.params.groupId}/events/`, {
        query,
        method: 'GET',
        success: (data, _, resp) => {
          this.setState({
            eventList: data,
            error: false,
            loading: false,
            pageLinks: resp?.getResponseHeader('Link') ?? '',
          });
        },
        error: err => {
          this.setState({
            error: parseApiError(err),
            loading: false,
          });
        },
      });
    }
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

  renderNewAllEventsTab() {
    return (
      <AllEventsTable
        issueId={this.props.group.id}
        isPerfIssue={this.props.group.issueCategory === IssueCategory.PERFORMANCE}
        location={this.props.location}
        organization={this.props.organization}
        projectId={this.props.group.project.slug}
        totalEventCount={this.props.group.count}
        excludedTags={excludedTags}
      />
    );
  }

  renderSearchBar() {
    const {renderNewAllEventsTab: renderPerfIssueEvents} = this.state;

    if (renderPerfIssueEvents) {
      return (
        <EventSearchBar
          organization={this.props.organization}
          defaultQuery=""
          onSearch={this.handleSearch}
          excludedTags={excludedTags}
          query={this.state.query}
          hasRecentSearches={false}
        />
      );
    }
    return (
      <SearchBar
        defaultQuery=""
        placeholder={t('Search events by id, message, or tags')}
        query={this.state.query}
        onSearch={this.handleSearch}
      />
    );
  }

  renderResults() {
    const {group, params, organization} = this.props;
    const tagList = group.tags.filter(tag => tag.key !== 'user') || [];

    return (
      <EventsTable
        tagList={tagList}
        events={this.state.eventList}
        orgId={params.orgId}
        projectId={group.project.slug}
        groupId={params.groupId}
        orgFeatures={organization.features}
      />
    );
  }

  renderBody() {
    const {renderNewAllEventsTab} = this.state;

    let body: React.ReactNode;

    if (renderNewAllEventsTab) {
      return this.renderNewAllEventsTab();
    }
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

    return (
      <Fragment>
        <Panel className="event-list">
          <PanelBody>{body}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </Fragment>
    );
  }

  render() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <Wrapper>
            <FilterSection>
              <EnvironmentPageFilter />
              {this.renderSearchBar()}
            </FilterSection>
            {this.renderBody()}
          </Wrapper>
        </Layout.Main>
      </Layout.Body>
    );
  }
}

const FilterSection = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content 1fr;
`;

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

export {GroupEvents};

export default withOrganization(withApi(GroupEvents));
