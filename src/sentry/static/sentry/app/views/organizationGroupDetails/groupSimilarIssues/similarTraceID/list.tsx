import React from 'react';
import {Location, Query} from 'history';
import {browserHistory} from 'react-router';
import pick from 'lodash/pick';
import * as Sentry from '@sentry/react';
import styled from '@emotion/styled';

import {tct} from 'app/locale';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import GroupListHeader from 'app/components/issues/groupListHeader';
import {Panel, PanelBody} from 'app/components/panels';
import StreamGroup from 'app/components/stream/group';
import GroupStore from 'app/stores/groupStore';
import Pagination from 'app/components/pagination';
import withApi from 'app/utils/withApi';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Client} from 'app/api';
import {Group} from 'app/types';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingError from 'app/components/loadingError';
import DateTime from 'app/components/dateTime';
import {TableDataRow} from 'app/utils/discover/discoverQuery';

type CustomGroup = Group & {
  eventID: string;
  groupID: string;
};

type Period = {
  start: string;
  end: string;
};

type Props = {
  api: Client;
  orgSlug: string;
  issues: Array<TableDataRow>;
  period: Period;
  pageLinks: string | null;
  location: Location;
  traceID: string;
};

type State = {
  groups: Array<CustomGroup>;
  hasError: boolean;
  isLoading: boolean;
};

class List extends React.Component<Props, State> {
  state: State = {
    groups: [],
    hasError: false,
    isLoading: true,
  };

  componentDidMount() {
    this.getGroups();
  }

  getGroups = async () => {
    const {api, orgSlug, location, issues} = this.props;

    if (!issues.length) {
      this.setState({isLoading: false});
      return;
    }

    const issuesIds = issues.map(issue => `group=${issue['issue.id']}`).join('&');

    try {
      const groups = await api.requestPromise(
        `/organizations/${orgSlug}/issues/?${issuesIds}`,
        {
          method: 'GET',
          data: {
            sort: 'new',
            ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
          },
        }
      );

      const convertedGroups = this.convertGroupsIntoEventFormat(groups);

      // this is necessary, because the AssigneeSelector component fetches the group from the GroupStore
      // @ts-ignore Property 'add' does not exist on type 'Store'
      GroupStore.add(convertedGroups);
      this.setState({groups: convertedGroups, isLoading: false});
    } catch (error) {
      Sentry.captureException(error);
      this.setState({isLoading: false, hasError: true});
    }
  };

  // this little hack is necessary until we factored the groupStore or the EventOrGroupHeader component
  // the goal of this function is to insert the properties eventID and groupID, so then the link rendered
  // in the EventOrGroupHeader component will always have the structure '/organization/:orgSlug/issues/:groupId/event/:eventId/',
  // providing a smooth navigation between issues with the same trace ID
  convertGroupsIntoEventFormat = (groups: Array<Group>) => {
    const {issues} = this.props;

    return groups
      .map(group => {
        // the issue must always be found
        const foundIssue = issues.find(issue => group.id === String(issue['issue.id']));
        if (foundIssue) {
          // the eventID is the reason why we need to use the DiscoverQuery component.
          // At the moment the /issues/ endpoint above doesn't return this information
          return {...group, eventID: foundIssue.id, groupID: group.id};
        }
        return undefined;
      })
      .filter(event => !!event) as Array<CustomGroup>;
  };

  handleCursorChange(cursor: string, path: string, query: Query, pageDiff: number) {
    browserHistory.push({
      pathname: path,
      query: {...query, cursor: pageDiff <= 0 ? undefined : cursor},
    });
  }

  handleRetry = () => {
    this.getGroups();
  };

  renderContent = () => {
    const {issues, orgSlug, period, traceID} = this.props;

    if (!issues.length) {
      return (
        <EmptyStateWarning small withIcon={false}>
          {tct(
            'No issues with the same trace ID [traceID] were found in the period between [start] and [end]',
            {
              traceID,
              start: <DateTime date={period.start} timeAndDate />,
              end: <DateTime date={period.start} timeAndDate />,
            }
          )}
        </EmptyStateWarning>
      );
    }

    return issues.map(issue => (
      <StreamGroup
        key={issue.id}
        id={String(issue['issue.id'])}
        orgId={orgSlug}
        canSelect={false}
        withChart={false}
      />
    ));
  };

  render() {
    const {pageLinks, traceID} = this.props;
    const {isLoading, hasError} = this.state;

    if (isLoading) {
      return <LoadingIndicator />;
    }

    if (hasError) {
      return (
        <LoadingError
          message={tct(
            'An error occurred while fetching issues with the trace ID [traceID]',
            {
              traceID,
            }
          )}
          onRetry={this.handleRetry}
        />
      );
    }

    return (
      <React.Fragment>
        <StyledPanel>
          <GroupListHeader withChart={false} />
          <PanelBody>{this.renderContent()}</PanelBody>
        </StyledPanel>
        <StyledPagination pageLinks={pageLinks} onCursor={this.handleCursorChange} />
      </React.Fragment>
    );
  }
}

export default withApi(List);

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;
