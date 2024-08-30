import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconWrapper} from 'sentry/components/sidebarSection';
import GroupChart from 'sentry/components/stream/groupChart';
import {IconUser} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {
  TraceError,
  TraceErrorOrIssue,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {TraceDrawerComponents} from '../styles';

import {IssueSummary} from './issueSummary';

type IssueProps = {
  issue: TraceErrorOrIssue;
  organization: Organization;
};

const MAX_DISPLAYED_ISSUES_COUNT = 3;

const TABLE_WIDTH_BREAKPOINTS = {
  FIRST: 800,
  SECOND: 600,
  THIRD: 500,
  FOURTH: 400,
};

const issueOrderPriority: Record<keyof Theme['level'], number> = {
  fatal: 0,
  error: 1,
  warning: 2,
  sample: 3,
  info: 4,
  default: 5,
  unknown: 6,
};

function sortIssuesByLevel(a: TraceError, b: TraceError): number {
  // If the level is not defined in the priority map, default to unknown
  const aPriority = issueOrderPriority[a.level] ?? issueOrderPriority.unknown;
  const bPriority = issueOrderPriority[b.level] ?? issueOrderPriority.unknown;

  return aPriority - bPriority;
}

function Issue(props: IssueProps) {
  const {
    isPending,
    data: fetchedIssue,
    isError,
  } = useApiQuery<Group>(
    [
      `/issues/${props.issue.issue_id}/`,
      {
        query: {
          collapse: 'release',
          expand: 'inbox',
        },
      },
    ],
    {
      staleTime: 2 * 60 * 1000,
    }
  );

  return isPending ? (
    <StyledLoadingIndicatorWrapper>
      <LoadingIndicator size={24} mini />
    </StyledLoadingIndicatorWrapper>
  ) : fetchedIssue ? (
    <StyledPanelItem>
      <IssueSummaryWrapper>
        <IssueSummary
          data={fetchedIssue}
          organization={props.organization}
          event_id={props.issue.event_id}
        />
        <EventOrGroupExtraDetails data={fetchedIssue} />
      </IssueSummaryWrapper>
      <ChartWrapper>
        <GroupChart
          stats={
            fetchedIssue.filtered
              ? fetchedIssue.filtered.stats?.['24h']
              : fetchedIssue.stats?.['24h']
          }
          secondaryStats={fetchedIssue.filtered ? fetchedIssue.stats?.['24h'] : []}
          showSecondaryPoints
          showMarkLine
        />
      </ChartWrapper>
      <EventsWrapper>
        <PrimaryCount
          value={fetchedIssue.filtered ? fetchedIssue.filtered.count : fetchedIssue.count}
        />
      </EventsWrapper>
      <UserCountWrapper>
        <PrimaryCount
          value={
            fetchedIssue.filtered
              ? fetchedIssue.filtered.userCount
              : fetchedIssue.userCount
          }
        />
      </UserCountWrapper>
      <AssineeWrapper>
        {fetchedIssue.assignedTo ? (
          <ActorAvatar actor={fetchedIssue.assignedTo} hasTooltip size={24} />
        ) : (
          <StyledIconWrapper>
            <IconUser size="md" />
          </StyledIconWrapper>
        )}
      </AssineeWrapper>
    </StyledPanelItem>
  ) : isError ? (
    <LoadingError message={t('Failed to fetch issue')} />
  ) : null;
}

type IssueListProps = {
  issues: TraceErrorOrIssue[];
  node: TraceTreeNode<TraceTree.NodeValue>;
  organization: Organization;
};

export function IssueList({issues, node, organization}: IssueListProps) {
  const uniqueErrorIssues = useMemo(() => {
    const unique: TraceError[] = [];

    const seenIssues: Set<number> = new Set();

    for (const issue of node.errors) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, node.errors.size]);

  const uniquePerformanceIssues = useMemo(() => {
    const unique: TracePerformanceIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of node.performance_issues) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, node.performance_issues.size]);

  const uniqueIssues = useMemo(() => {
    return [...uniquePerformanceIssues, ...uniqueErrorIssues.sort(sortIssuesByLevel)];
  }, [uniqueErrorIssues, uniquePerformanceIssues]);

  if (!issues.length) {
    return null;
  }

  return (
    <StyledPanel>
      <IssueListHeader
        node={node}
        errorIssues={uniqueErrorIssues}
        performanceIssues={uniquePerformanceIssues}
      />
      {uniqueIssues.slice(0, MAX_DISPLAYED_ISSUES_COUNT).map((issue, index) => (
        <Issue key={index} issue={issue} organization={organization} />
      ))}
    </StyledPanel>
  );
}

function IssueListHeader({
  node,
  errorIssues,
  performanceIssues,
}: {
  errorIssues: TraceError[];
  node: TraceTreeNode<TraceTree.NodeValue>;
  performanceIssues: TracePerformanceIssue[];
}) {
  const [singular, plural] = useMemo((): [string, string] => {
    const label = [t('Issue'), t('Issues')] as [string, string];
    for (const event of errorIssues) {
      if (event.level === 'error' || event.level === 'fatal') {
        return [t('Error'), t('Errors')];
      }
    }
    return label;
  }, [errorIssues]);

  return (
    <StyledPanelHeader disablePadding>
      <IssueHeading>
        {errorIssues.length + performanceIssues.length > MAX_DISPLAYED_ISSUES_COUNT
          ? tct(`[count]+  issues, [link]`, {
              count: MAX_DISPLAYED_ISSUES_COUNT,
              link: <StyledIssuesLink node={node}>{t('View All')}</StyledIssuesLink>,
            })
          : errorIssues.length > 0 && performanceIssues.length === 0
            ? tct('[count] [text]', {
                count: errorIssues.length,
                text: errorIssues.length > 1 ? plural : singular,
              })
            : performanceIssues.length > 0 && errorIssues.length === 0
              ? tct('[count] [text]', {
                  count: performanceIssues.length,
                  text: tn(
                    'Performance issue',
                    'Performance Issues',
                    performanceIssues.length
                  ),
                })
              : tct(
                  '[errors] [errorsText] and [performance_issues] [performanceIssuesText]',
                  {
                    errors: errorIssues.length,
                    performance_issues: performanceIssues.length,
                    errorsText: errorIssues.length > 1 ? plural : singular,
                    performanceIssuesText: tn(
                      'performance issue',
                      'performance issues',
                      performanceIssues.length
                    ),
                  }
                )}
      </IssueHeading>
      <GraphHeading>{t('Graph')}</GraphHeading>
      <EventsHeading>{t('Events')}</EventsHeading>
      <UsersHeading>{t('Users')}</UsersHeading>
      <AssigneeHeading>{t('Assignee')}</AssigneeHeading>
    </StyledPanelHeader>
  );
}

const StyledIssuesLink = styled(TraceDrawerComponents.IssuesLink)`
  margin-left: ${space(0.5)};
`;

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

const StyledLoadingIndicatorWrapper = styled('div')`
  display: flex;
  justify-content: center;
  width: 100%;
  padding: ${space(2)} 0;
  height: 84px;

  /* Add a border between two rows of loading issue states */
  & + & {
    border-top: 1px solid ${p => p.theme.border};
  }
`;

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
