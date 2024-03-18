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
import type {Group, Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {
  isAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';

import {IssueSummary} from './issueSummary';

type IssueProps = {
  event_id: string;
  issue: TraceErrorOrIssue;
  organization: Organization;
};

function Issue(props: IssueProps) {
  const {
    isLoading,
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

  return isLoading ? (
    <StyledLoadingIndicatorWrapper>
      <LoadingIndicator size={24} mini />
    </StyledLoadingIndicatorWrapper>
  ) : fetchedIssue ? (
    <StyledPanelItem>
      <IssueSummaryWrapper>
        <IssueSummary
          data={fetchedIssue}
          organization={props.organization}
          event_id={props.event_id}
        />
        <EventOrGroupExtraDetails data={fetchedIssue} />
      </IssueSummaryWrapper>
      <ChartWrapper>
        <GroupChart
          statsPeriod={'24h'}
          data={fetchedIssue}
          showSecondaryPoints
          showMarkLine
        />
      </ChartWrapper>
      <ColumnWrapper>
        <PrimaryCount
          value={fetchedIssue.filtered ? fetchedIssue.filtered.count : fetchedIssue.count}
        />
      </ColumnWrapper>
      <ColumnWrapper>
        <PrimaryCount
          value={
            fetchedIssue.filtered
              ? fetchedIssue.filtered.userCount
              : fetchedIssue.userCount
          }
        />
      </ColumnWrapper>
      <ColumnWrapper>
        {fetchedIssue.assignedTo ? (
          <ActorAvatar actor={fetchedIssue.assignedTo} hasTooltip size={24} />
        ) : (
          <StyledIconWrapper>
            <IconUser size="md" />
          </StyledIconWrapper>
        )}
      </ColumnWrapper>
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
  if (!issues.length) {
    return null;
  }

  return (
    <StyledPanel>
      <IssueListHeader node={node} />
      {issues.map((issue, index) => (
        <Issue
          key={index}
          issue={issue}
          organization={organization}
          event_id={issue.event_id}
        />
      ))}
    </StyledPanel>
  );
}

function IssueListHeader({node}: {node: TraceTreeNode<TraceTree.NodeValue>}) {
  const errors =
    isSpanNode(node) || isTransactionNode(node)
      ? node.value.errors.length
      : isAutogroupedNode(node)
        ? node.errors.length
        : isTraceErrorNode(node)
          ? 1
          : 0;

  const performance_issues =
    isSpanNode(node) || isTransactionNode(node)
      ? node.value.performance_issues.length
      : isAutogroupedNode(node)
        ? node.performance_issues.length
        : isTraceErrorNode(node)
          ? 0
          : 0;

  return (
    <StyledPanelHeader disablePadding>
      <IssueHeading>
        {errors > 0 && performance_issues === 0
          ? tct('[count] [text]', {
              count: errors,
              text: tn('Error', 'Errors', errors),
            })
          : performance_issues > 0 && errors === 0
            ? tct('[count] [text]', {
                count: errors,
                text: tn('Performance issue', 'Performance Issues', errors),
              })
            : tct(
                '[errors] [errorsText] and [performance_issues] [performanceIssuesText]',
                {
                  errors,
                  performance_issues,
                  errorsText: tn('Error', 'Errors', errors),
                  performanceIssuesText: tn(
                    'performance issue',
                    'performance issues',
                    performance_issues
                  ),
                }
              )}
      </IssueHeading>
      <GraphHeading>{t('Graph')}</GraphHeading>
      <Heading>{t('Events')}</Heading>
      <UsersHeading>{t('Users')}</UsersHeading>
      <Heading>{t('Assignee')}</Heading>
    </StyledPanelHeader>
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

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const GraphHeading = styled(Heading)`
  width: 160px;
  display: flex;
  justify-content: center;
`;

const UsersHeading = styled(Heading)`
  display: flex;
  justify-content: center;
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
  border: 1px solid ${p => p.theme.red200};
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.red200};
`;

const StyledLoadingIndicatorWrapper = styled('div')`
  display: flex;
  justify-content: center;
  width: 100%;
  padding: ${space(2)} 0;
  height: 84px;
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

const ChartWrapper = styled('div')`
  width: 200px;
  align-self: center;
`;

const ColumnWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};
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
