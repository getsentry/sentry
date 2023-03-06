import {Component} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import EventSearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {handleRouteLeave} from 'sentry/utils/useCleanQueryParamsOnRouteLeave';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';

import AllEventsTable from './allEventsTable';

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
} & RouteComponentProps<{groupId: string}, {}>;

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
    const {organization} = this.props;
    const {groupId} = this.props.params;

    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/issues/${groupId}/events/`,
        query: targetQueryParams,
      })
    );
  };

  render() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <AllEventsFilters>
            <EventSearchBar
              organization={this.props.organization}
              defaultQuery=""
              onSearch={this.handleSearch}
              excludedTags={excludedTags}
              query={this.state.query}
              hasRecentSearches={false}
            />
          </AllEventsFilters>
          <AllEventsTable
            issueId={this.props.group.id}
            location={this.props.location}
            organization={this.props.organization}
            group={this.props.group}
            excludedTags={excludedTags}
          />
        </Layout.Main>
      </Layout.Body>
    );
  }
}

const AllEventsFilters = styled('div')`
  margin-bottom: ${space(2)};
`;

export {GroupEvents};

export default withOrganization(withApi(GroupEvents));
