import {Component} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import EventSearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import space from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {handleRouteLeave} from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import AllEventsTable from './allEventsTable';

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
} & RouteComponentProps<{groupId: string; orgId: string}, {}>;

interface State {
  query: string;
}

const excludedTags = ['environment', 'issue', 'issue.id', 'performance.issue_ids'];

class GroupEvents extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const queryParams = this.props.location.query;

    this.state = {
      query: queryParams.query || '',
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.props.location.search !== nextProps.location.search) {
      const queryParams = nextProps.location.query;

      this.setState({
        query: queryParams.query,
      });
    }
  }

  UNSAFE_componentDidMount() {
    this._unsubscribeHandleRouteLeave = browserHistory.listen(newLocation =>
      handleRouteLeave({
        fieldsToClean: ['cursor'],
        newLocation,
        oldPathname: this.props.location.pathname,
      })
    );
  }

  UNSAFE_componentWillUnmount() {
    this._unsubscribeHandleRouteLeave?.();
  }

  _unsubscribeHandleRouteLeave: undefined | ReturnType<typeof browserHistory.listen>;

  handleSearch = (query: string) => {
    const targetQueryParams = {...this.props.location.query};
    targetQueryParams.query = query;
    const {groupId, orgId} = this.props.params;

    browserHistory.push({
      pathname: `/organizations/${orgId}/issues/${groupId}/events/`,
      query: targetQueryParams,
    });
  };

  renderSearchBar() {
    // New issue actions moves the environment picker to the header
    const hasIssueActionsV2 =
      this.props.organization.features.includes('issue-actions-v2');

    const searchBar = (
      <EventSearchBar
        organization={this.props.organization}
        defaultQuery=""
        onSearch={this.handleSearch}
        excludedTags={excludedTags}
        query={this.state.query}
        hasRecentSearches={false}
      />
    );

    if (hasIssueActionsV2) {
      return searchBar;
    }
    return (
      <FilterSection>
        <EnvironmentPageFilter />
        {searchBar}
      </FilterSection>
    );
  }

  render() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <Wrapper>
            {this.renderSearchBar()}
            <AllEventsTable
              issueId={this.props.group.id}
              location={this.props.location}
              organization={this.props.organization}
              group={this.props.group}
              excludedTags={excludedTags}
            />
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
