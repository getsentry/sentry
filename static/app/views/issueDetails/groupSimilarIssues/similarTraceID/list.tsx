import {Component} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import pick from 'lodash/pick';

import {Client} from 'sentry/api';
import DateTime from 'sentry/components/dateTime';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import IssuesReplayCountProvider from 'sentry/components/replays/issuesReplayCountProvider';
import StreamGroup from 'sentry/components/stream/group';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {GroupResolution} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import withApi from 'sentry/utils/withApi';

type CustomGroup = GroupResolution & {
  eventID: string;
  groupID: string;
};

type Period = {
  end: string;
  start: string;
};

type Props = {
  api: Client;
  issues: Array<TableDataRow>;
  location: Location;
  orgSlug: string;
  pageLinks: string | null;
  period: Period;
  traceID: string;
};

type State = {
  groups: Array<CustomGroup>;
  hasError: boolean;
  isLoading: boolean;
};

class List extends Component<Props, State> {
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
  convertGroupsIntoEventFormat = (groups: Array<GroupResolution>) => {
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

  handleCursorChange: CursorHandler = (cursor, path, query, delta) =>
    browserHistory.push({
      pathname: path,
      query: {...query, cursor: delta <= 0 ? undefined : cursor},
    });

  handleRetry = () => {
    this.getGroups();
  };

  renderContent = () => {
    const {issues, period, traceID} = this.props;

    if (!issues.length) {
      return (
        <EmptyStateWarning small withIcon={false}>
          {tct(
            'No issues with the same trace ID [traceID] were found in the period between [start] and [end]',
            {
              traceID,
              start: <DateTime date={period.start} />,
              end: <DateTime date={period.start} />,
            }
          )}
        </EmptyStateWarning>
      );
    }

    return issues.map(issue => (
      <StreamGroup
        key={issue.id}
        id={String(issue['issue.id'])}
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

    const groupIds = this.props.issues.map(({id}) => id);
    return (
      <IssuesReplayCountProvider groupIds={groupIds}>
        <StyledPanel>
          <GroupListHeader withChart={false} />
          <PanelBody>{this.renderContent()}</PanelBody>
        </StyledPanel>
        <StyledPagination pageLinks={pageLinks} onCursor={this.handleCursorChange} />
      </IssuesReplayCountProvider>
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
