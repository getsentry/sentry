import {Fragment} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconWrapper} from 'sentry/components/sidebarSection';
import GroupChart from 'sentry/components/stream/groupChart';
import {IconUser} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {IssueSummary} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issueSummary';

const TABLE_WIDTH_BREAKPOINTS = {
  FIRST: 800,
  SECOND: 600,
  THIRD: 500,
  FOURTH: 400,
};

function Issue({data}: {data: Group}) {
  const organization = useOrganization();

  return (
    <StyledPanelItem as="tr">
      <IssueSummaryWrapper>
        <IssueSummary data={data} organization={organization} />
        <EventOrGroupExtraDetails data={data} />
      </IssueSummaryWrapper>
      <ChartWrapper>
        <GroupChart
          stats={data.filtered ? data.filtered.stats?.['24h']! : data.stats?.['24h']!}
          secondaryStats={data.filtered ? data.stats?.['24h']! : []}
          showSecondaryPoints
          showMarkLine
        />
      </ChartWrapper>
      <EventsWrapper>
        <PrimaryCount value={data.filtered ? data.filtered.count : data.count} />
      </EventsWrapper>
      <UserCountWrapper>
        <PrimaryCount value={data.filtered ? data.filtered.userCount : data.userCount} />
      </UserCountWrapper>
      <AssineeWrapper>
        {data.assignedTo ? (
          <ActorAvatar actor={data.assignedTo} hasTooltip size={24} />
        ) : (
          <StyledIconWrapper>
            <IconUser size="md" />
          </StyledIconWrapper>
        )}
      </AssineeWrapper>
    </StyledPanelItem>
  );
}

function IssueListHeader({issues}: {issues?: Group[]}) {
  return (
    <StyledPanelHeader as="tr">
      <IssueHeading>
        {tct(`[count] [text]`, {
          count: issues?.length ?? 0,
          text: tn('Related Issue', 'Related Issues', issues?.length ?? 0),
        })}
      </IssueHeading>

      <GraphHeading>{t('Graph')}</GraphHeading>
      <EventsHeading>{t('Events')}</EventsHeading>
      <UsersHeading>{t('Users')}</UsersHeading>
      <AssigneeHeading>{t('Assignee')}</AssigneeHeading>
    </StyledPanelHeader>
  );
}

function useInsightIssues(
  issueTypes: string[],
  message?: string
): {isLoading: boolean; issues?: Group[]} {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  let query = `issue.type:[${issueTypes.join(',')}]`;
  // note: backend supports a maximum number of characters for message (seems to vary).
  // so, we query the first 200 characters of `message`, then filter for exact `message`
  // matches in application code
  query += ` message:"${message?.slice(0, 200).replaceAll('"', '\\"')}"`;

  const {isPending, data: maybeMatchingIssues} = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          expand: ['inbox', 'owners'],
          query,
          shortIdLookup: 1,
          // hack: set an arbitrary large upper limit so that the api response likely contains the exact message,
          // even though we only search for the first 200 characters of the message
          limit: 100,
          project: selection.projects,
          environment: selection.environments,
          ...normalizeDateTimeParams(selection.datetime),
        },
      },
    ],
    {
      staleTime: 2 * 60 * 1000,
      enabled: !!message,
    }
  );

  if (!message) {
    return {isLoading: false, issues: []};
  }

  // the api response contains issues that match the first 200 characters of the message. now,
  // filter by the issues that match the exact message the user is searching for
  const issues = maybeMatchingIssues?.filter(issue => issue.metadata.value === message);

  return {isLoading: isPending, issues};
}

export default function InsightIssuesList({
  issueTypes,
  message,
}: {
  issueTypes: string[];
  message?: string;
}) {
  const {isLoading, issues} = useInsightIssues(issueTypes, message);

  if (isLoading || issues?.length === 0) {
    return <Fragment />;
  }

  return (
    <StyledPanel>
      <IssueListHeader issues={issues} />
      {issues?.map(issue => <Issue data={issue} key={issue.id} />)}
    </StyledPanel>
  );
}

const Heading = styled('th')`
  display: flex;
  align-self: center;
  margin: 0 ${space(2)};
  width: 60px;
  color: ${p => p.theme.subText};
`;

const IssueHeading = styled(Heading)`
  flex: 1;
  width: 66.66%;
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const GraphHeading = styled(Heading)`
  width: 160px;
  display: flex;
  justify-content: center;

  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FIRST}px) {
    display: none;
  }
`;

const EventsHeading = styled(Heading)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.SECOND}px) {
    display: none;
  }
`;

const UsersHeading = styled(Heading)`
  display: flex;
  justify-content: center;

  @container (width < ${TABLE_WIDTH_BREAKPOINTS.THIRD}px) {
    display: none;
  }
`;

const AssigneeHeading = styled(Heading)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FOURTH}px) {
    display: none;
  }
`;

const StyledPanel = styled(Panel)`
  container-type: inline-size;
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
`;

const StyledIconWrapper = styled(IconWrapper)`
  margin: 0;
`;

const IssueSummaryWrapper = styled('td')`
  overflow: hidden;
  flex: 1;
  width: 66.66%;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const ColumnWrapper = styled('td')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};
`;

const EventsWrapper = styled(ColumnWrapper)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.SECOND}px) {
    display: none;
  }
`;

const UserCountWrapper = styled(ColumnWrapper)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.THIRD}px) {
    display: none;
  }
`;

const AssineeWrapper = styled(ColumnWrapper)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FOURTH}px) {
    display: none;
  }
`;

const ChartWrapper = styled('td')`
  width: 200px;
  align-self: center;

  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FIRST}px) {
    display: none;
  }
`;

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.fontSizeLarge};
  font-variant-numeric: tabular-nums;
`;

const StyledPanelItem = styled(PanelItem)`
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
  height: 84px;
`;
