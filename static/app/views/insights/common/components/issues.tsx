import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconWrapper} from 'sentry/components/sidebarSection';
import GroupChart from 'sentry/components/stream/groupChart';
import {IconUser} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types';
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
    <StyledPanelItem>
      <IssueSummaryWrapper>
        <IssueSummary data={data} organization={organization} event_id={'0'} />
        <EventOrGroupExtraDetails data={data} />
      </IssueSummaryWrapper>
      <ChartWrapper>
        <GroupChart
          stats={data.filtered ? data.filtered.stats?.['24h'] : data.stats?.['24h']}
          secondaryStats={data.filtered ? data.stats?.['24h'] : []}
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
    <StyledPanelHeader>
      {/* todo: fix plurality */}
      {issues && (
        <IssueHeading>
          {tct(`[count] [text]`, {
            count: issues.length,
            text: tn('Performance Issue', 'Performance Issues', issues.length),
          })}
        </IssueHeading>
      )}

      <GraphHeading>{t('Graph')}</GraphHeading>
      <EventsHeading>{t('Events')}</EventsHeading>
      <UsersHeading>{t('Users')}</UsersHeading>
      <AssigneeHeading>{t('Assignee')}</AssigneeHeading>
    </StyledPanelHeader>
  );
}

function EmptyListScreen() {
  return (
    <Wrapper>
      <MessageContainer>
        <h5>There were no open issues related to this query</h5>
        <div>Have you considered dropping some indexes?</div>
      </MessageContainer>
    </Wrapper>
  );
}

const MessageContainer = styled('div')`
  align-self: center;
  max-width: 800px;
  margin-left: 40px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin: 0;
  }
`;

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
  border-radius: 0 0 3px 3px;
  padding: 40px ${space(3)};
  min-height: 120px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: center;
    padding: ${space(3)};
    text-align: center;
  }
`;

export default function InsightIssuesList({issueTypes}: {issueTypes: string[]}) {
  // fetch issue ids that have the current issue types, with the given pageFilter settings
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const query = `issue.type:[${issueTypes.join(',')}]`;
  const {
    isLoading,
    data: fetchedIssues,
    // isError,
  } = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          collapse: ['stats', 'unhandled'],
          expand: ['inbox', 'owners'],
          query,
          shortIdLookup: 1,
          limit: 5,
          project: selection.projects,
          ...normalizeDateTimeParams(selection.datetime),
        },
      },
    ],
    {
      staleTime: 2 * 60 * 1000,
    }
  );

  const {data: issuesStats} = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues-stats/`,
      {
        query: {
          query,
          groups: fetchedIssues?.map(issue => issue.id),
          project: selection.projects,
          ...normalizeDateTimeParams(selection.datetime),
        },
      },
    ],
    {
      staleTime: 2 * 60 * 1000,
    }
  );

  const issues = fetchedIssues?.map(issue => ({
    ...issue,
    ...issuesStats?.find(stats => stats.id === issue.id),
  }));

  // console.log([fetchedIssues?.map(issue => issue.id)]);
  // console.log('fetched stats data', fetchedIssuesStatsData);
  // console.log('enriched', enrichedIssues);
  // pass issue data into <Issue /> (do not refetch the data per issue)

  return (
    <StyledPanel>
      <IssueListHeader issues={issues} />
      {isLoading ? (
        <LoadingIndicator />
      ) : issues && issues?.length > 0 ? (
        issues?.map(issue => <Issue data={issue} key={issue.id} />)
      ) : (
        <EmptyListScreen />
      )}
    </StyledPanel>
  );
}

const Heading = styled('div')`
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

// const StyledLoadingIndicatorWrapper = styled('div')`
//   display: flex;
//   justify-content: center;
//   width: 100%;
//   padding: ${space(2)} 0;
//   height: 84px;

//   /* Add a border between two rows of loading issue states */
//   & + & {
//     border-top: 1px solid ${p => p.theme.border};
//   }
// `;

const StyledIconWrapper = styled(IconWrapper)`
  margin: 0;
`;

const IssueSummaryWrapper = styled('div')`
  overflow: hidden;
  flex: 1;
  width: 66.66%;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const ColumnWrapper = styled('div')`
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

const ChartWrapper = styled('div')`
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
