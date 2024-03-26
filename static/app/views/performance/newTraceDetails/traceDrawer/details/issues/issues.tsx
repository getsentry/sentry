import {useMemo} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
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
import type {Group, Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../../../guards';

import {IssueSummary} from './issueSummary';

type IssueProps = {
  issue: TraceErrorOrIssue;
  organization: Organization;
};

const MAX_DISPLAYED_ISSUES_COUNT = 10;

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
          event_id={props.issue.event_id}
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
      {issues.slice(0, MAX_DISPLAYED_ISSUES_COUNT).map((issue, index) => (
        <Issue key={index} issue={issue} organization={organization} />
      ))}
    </StyledPanel>
  );
}

function getSearchParamFromNode(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isTransactionNode(node) || isTraceErrorNode(node)) {
    return `id:${node.value.event_id}`;
  }

  // Issues associated to a span or autogrouped node are not queryable, so we query by
  // the parent transaction's id
  const parentTransaction = node.parent_transaction;
  if ((isSpanNode(node) || isAutogroupedNode(node)) && parentTransaction) {
    return `id:${parentTransaction.value.event_id}`;
  }

  if (isMissingInstrumentationNode(node)) {
    throw new Error('Missing instrumentation nodes do not have associated issues');
  }

  return '';
}

function IssueListHeader({node}: {node: TraceTreeNode<TraceTree.NodeValue>}) {
  const {errors, performance_issues} = node;
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const traceSlug = params.traceSlug?.trim() ?? '';

  const dateSelection = useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(qs.parse(window.location.search), {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

    return {start, end, statsPeriod};
  }, []);

  return (
    <StyledPanelHeader disablePadding>
      <IssueHeading>
        {errors.size + performance_issues.size > MAX_DISPLAYED_ISSUES_COUNT
          ? tct(`[count]+  issues, [link]`, {
              count: MAX_DISPLAYED_ISSUES_COUNT,
              link: (
                <StyledLink
                  to={{
                    pathname: `/organizations/${organization.slug}/issues/`,
                    query: {
                      query: `trace:${traceSlug} ${getSearchParamFromNode(node)}`,
                      start: dateSelection.start,
                      end: dateSelection.end,
                      statsPeriod: dateSelection.statsPeriod,
                    },
                  }}
                >
                  {t('View All')}
                </StyledLink>
              ),
            })
          : errors.size > 0 && performance_issues.size === 0
            ? tct('[count] [text]', {
                count: errors.size,
                text: tn('Error', 'Errors', errors.size),
              })
            : performance_issues.size > 0 && errors.size === 0
              ? tct('[count] [text]', {
                  count: performance_issues.size,
                  text: tn(
                    'Performance issue',
                    'Performance Issues',
                    performance_issues.size
                  ),
                })
              : tct(
                  '[errors] [errorsText] and [performance_issues] [performanceIssuesText]',
                  {
                    errors: errors.size,
                    performance_issues: performance_issues.size,
                    errorsText: tn('Error', 'Errors', errors.size),
                    performanceIssuesText: tn(
                      'performance issue',
                      'performance issues',
                      performance_issues.size
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

const StyledLink = styled(Link)`
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
