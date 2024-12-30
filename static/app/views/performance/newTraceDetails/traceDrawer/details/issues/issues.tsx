import {Fragment, useMemo} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import GroupStatusChart from 'sentry/components/charts/groupStatusChart';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {getBadgeProperties} from 'sentry/components/group/inboxBadges/statusBadge';
import IssueStreamHeaderLabel from 'sentry/components/IssueStreamHeaderLabel';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {PrimaryCount} from 'sentry/components/stream/group';
import {IconOpen} from 'sentry/icons';
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
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {HeaderDivider} from 'sentry/views/issueList/actions';
import {NarrowAssigneeLabel} from 'sentry/views/issueList/actions/headers';

import {isTracePerformanceIssue} from '../../../traceGuards';
import {TraceIcons} from '../../../traceIcons';
import type {TraceTree} from '../../../traceModels/traceTree';
import type {TraceTreeNode} from '../../../traceModels/traceTreeNode';
import {useHasTraceNewUi} from '../../../useHasTraceNewUi';
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
  const {organization} = props;
  const hasTraceNewUi = useHasTraceNewUi();
  const {
    isPending,
    data: fetchedIssue,
    isError,
    error,
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
      enabled: !!props.issue.issue_id,
      staleTime: 2 * 60 * 1000,
    }
  );

  const hasNewLayout = organization.features.includes('issue-stream-table-layout');

  if (!hasTraceNewUi) {
    return (
      <LegacyIssue
        {...props}
        isError={isError}
        fetchedIssue={fetchedIssue}
        error={error}
        isPending={isPending}
      />
    );
  }

  const isPerformanceIssue: boolean = isTracePerformanceIssue(props.issue);
  const iconClassName: string = isPerformanceIssue
    ? 'performance_issue'
    : props.issue.level;

  return isPending ? (
    <StyledLoadingIndicatorWrapper>
      <LoadingIndicator size={24} mini />
    </StyledLoadingIndicatorWrapper>
  ) : fetchedIssue ? (
    <StyledPanelItem hasNewLayout={hasNewLayout}>
      <IconWrapper className={iconClassName}>
        <IconBackground className={iconClassName}>
          <TraceIcons.Icon event={props.issue} />
        </IconBackground>
      </IconWrapper>
      {hasNewLayout ? (
        <NarrowSummaryWrapper>
          <EventOrGroupHeader
            data={fetchedIssue}
            organization={organization}
            eventId={props.issue.event_id}
          />
          <EventOrGroupExtraDetails data={fetchedIssue} />
        </NarrowSummaryWrapper>
      ) : (
        <SummaryWrapper>
          <IssueSummary
            data={fetchedIssue}
            organization={props.organization}
            event_id={props.issue.event_id}
          />
          <EventOrGroupExtraDetails data={fetchedIssue} />
        </SummaryWrapper>
      )}
    </StyledPanelItem>
  ) : isError ? (
    <LoadingError
      message={
        error.status === 404 ? t('This issue was deleted') : t('Failed to fetch issue')
      }
    />
  ) : null;
}

const IconBackground = styled('div')`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 16px;
    height: 16px;
    fill: ${p => p.theme.white};
  }
`;

const IconWrapper = styled('div')`
  border-radius: 50%;
  padding: ${space(0.25)};

  &.info {
    border: 1px solid var(--info);
    ${IconBackground} {
      background-color: var(--info);
    }
  }
  &.warning {
    border: 1px solid var(--warning);
    ${IconBackground} {
      background-color: var(--warning);
    }
  }
  &.debug {
    border: 1px solid var(--debug);
    ${IconBackground} {
      background-color: var(--debug);
    }
  }
  &.error,
  &.fatal {
    border: 1px solid var(--error);
    ${IconBackground} {
      background-color: var(--error);
    }
  }
  &.performance_issue {
    border: 1px solid var(--performance-issue);
    ${IconBackground} {
      background-color: var(--performance-issue);
    }
  }
  &.default {
    border: 1px solid var(--default);
    ${IconBackground} {
      background-color: var(--default);
    }
  }
  &.unknown {
    border: 1px solid var(--unknown);
    ${IconBackground} {
      background-color: var(--unknown);
    }
  }

  &.info,
  &.warning,
  &.performance_issue,
  &.default,
  &.unknown {
    svg {
      transform: translateY(-1px);
    }
  }
`;

const NarrowSummaryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  justify-content: left;
`;

const SummaryWrapper = styled('div')`
  overflow: hidden;
  flex: 1;
`;

function LegacyIssue(
  props: IssueProps & {
    error: RequestError | null;
    fetchedIssue: Group | undefined;
    isError: boolean;
    isPending: boolean;
  }
) {
  const {organization} = props;
  const hasNewLayout = organization.features.includes('issue-stream-table-layout');

  return props.isPending ? (
    <StyledLoadingIndicatorWrapper>
      <LoadingIndicator size={24} mini />
    </StyledLoadingIndicatorWrapper>
  ) : props.fetchedIssue ? (
    <StyledLegacyPanelItem hasNewLayout={hasNewLayout}>
      {hasNewLayout ? (
        <NarrowIssueSummaryWrapper>
          <EventOrGroupHeader data={props.fetchedIssue} organization={organization} />
          <EventOrGroupExtraDetails data={props.fetchedIssue} />
        </NarrowIssueSummaryWrapper>
      ) : (
        <IssueSummaryWrapper>
          <IssueSummary
            data={props.fetchedIssue}
            organization={props.organization}
            event_id={props.issue.event_id}
          />
          <EventOrGroupExtraDetails data={props.fetchedIssue} />
        </IssueSummaryWrapper>
      )}
      <ChartWrapper>
        <GroupStatusChart
          stats={
            props.fetchedIssue.filtered
              ? props.fetchedIssue.filtered.stats?.['24h']
              : props.fetchedIssue.stats?.['24h']
          }
          secondaryStats={
            props.fetchedIssue.filtered ? props.fetchedIssue.stats?.['24h'] : []
          }
          groupStatus={
            getBadgeProperties(props.fetchedIssue.status, props.fetchedIssue.substatus)
              ?.status
          }
          hideZeros
          showSecondaryPoints
          showMarkLine
        />
      </ChartWrapper>
      <EventsWrapper>
        {hasNewLayout ? (
          <NarrowEventsOrUsersWrapper>
            <PrimaryCount
              value={
                props.fetchedIssue.filtered
                  ? props.fetchedIssue.filtered.count
                  : props.fetchedIssue.count
              }
            />
          </NarrowEventsOrUsersWrapper>
        ) : (
          <PrimaryCount
            value={
              props.fetchedIssue.filtered
                ? props.fetchedIssue.filtered.count
                : props.fetchedIssue.count
            }
          />
        )}
      </EventsWrapper>
      {hasNewLayout ? (
        <NarrowEventsOrUsersWrapper>
          <PrimaryCount
            value={
              props.fetchedIssue.filtered
                ? props.fetchedIssue.filtered.userCount
                : props.fetchedIssue.userCount
            }
          />
        </NarrowEventsOrUsersWrapper>
      ) : (
        <UserCountWrapper>
          <PrimaryCount
            value={
              props.fetchedIssue.filtered
                ? props.fetchedIssue.filtered.userCount
                : props.fetchedIssue.userCount
            }
          />
        </UserCountWrapper>
      )}
      {hasNewLayout ? (
        <NarrowAssigneeWrapper>
          <AssigneeBadge assignedTo={props.fetchedIssue.assignedTo ?? undefined} />
        </NarrowAssigneeWrapper>
      ) : (
        <AssigneeWrapper>
          <AssigneeBadge assignedTo={props.fetchedIssue.assignedTo ?? undefined} />
        </AssigneeWrapper>
      )}
    </StyledLegacyPanelItem>
  ) : props.isError ? (
    <LoadingError
      message={
        props.error?.status === 404
          ? t('This issue was deleted')
          : t('Failed to fetch issue')
      }
    />
  ) : null;
}
type IssueListProps = {
  issues: TraceErrorOrIssue[];
  node: TraceTreeNode<TraceTree.NodeValue>;
  organization: Organization;
};

export function IssueList({issues, node, organization}: IssueListProps) {
  const hasTraceNewUi = useHasTraceNewUi();
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

  if (!hasTraceNewUi) {
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

  return (
    <IssuesWrapper>
      <StyledPanel>
        {uniqueIssues.slice(0, MAX_DISPLAYED_ISSUES_COUNT).map((issue, index) => (
          <Issue key={index} issue={issue} organization={organization} />
        ))}
      </StyledPanel>
      {uniqueIssues.length > MAX_DISPLAYED_ISSUES_COUNT ? (
        <TraceDrawerComponents.IssuesLink node={node}>
          <IssueLinkWrapper>
            <IconOpen />
            {t(
              `Open %s more in Issues`,
              uniqueIssues.length - MAX_DISPLAYED_ISSUES_COUNT
            )}
          </IssueLinkWrapper>
        </TraceDrawerComponents.IssuesLink>
      ) : null}
    </IssuesWrapper>
  );
}

const IssueLinkWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-left: ${space(0.25)};
`;

function IssueListHeader({
  node,
  errorIssues,
  performanceIssues,
}: {
  errorIssues: TraceError[];
  node: TraceTreeNode<TraceTree.NodeValue>;
  performanceIssues: TracePerformanceIssue[];
}) {
  const organization = useOrganization();

  const [singular, plural] = useMemo((): [string, string] => {
    const label = [t('Issue'), t('Issues')] as [string, string];
    for (const event of errorIssues) {
      if (event.level === 'error' || event.level === 'fatal') {
        return [t('Error'), t('Errors')];
      }
    }
    return label;
  }, [errorIssues]);

  const hasNewLayout = organization.features.includes('issue-stream-table-layout');

  const issueHeadingContent =
    errorIssues.length + performanceIssues.length > MAX_DISPLAYED_ISSUES_COUNT
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
            );

  return (
    <StyledPanelHeader disablePadding hasNewLayout={hasNewLayout}>
      {hasNewLayout ? (
        <StyledIssueStreamHeaderLabel>
          {issueHeadingContent}
          <HeaderDivider />
        </StyledIssueStreamHeaderLabel>
      ) : (
        <IssueHeading>{issueHeadingContent}</IssueHeading>
      )}
      {hasNewLayout ? (
        <Fragment>
          <NarrowGraphLabel>
            {t('Trend')}
            <HeaderDivider />
          </NarrowGraphLabel>
          <NarrowEventsLabel>
            {t('Events')}
            <HeaderDivider />
          </NarrowEventsLabel>
          <NarrowUsersLabel>
            {t('Users')}
            <HeaderDivider />
          </NarrowUsersLabel>
          <NarrowAssigneeLabel>{t('Assignee')}</NarrowAssigneeLabel>
        </Fragment>
      ) : (
        <Fragment>
          <GraphHeading>{t('Graph')}</GraphHeading>
          <EventsHeading>{t('Events')}</EventsHeading>
          <UsersHeading>{t('Users')}</UsersHeading>
          <AssigneeHeading>{t('Assignee')}</AssigneeHeading>
        </Fragment>
      )}
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

const NarrowGraphLabel = styled(IssueStreamHeaderLabel)`
  width: 200px;
  display: flex;
  justify-content: space-between;

  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FIRST}px) {
    display: none;
  }
`;

const EventsHeading = styled(Heading)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.SECOND}px) {
    display: none;
  }
`;

const NarrowEventsLabel = styled(EventsHeading)`
  display: flex;
  justify-content: space-between;
  width: 60px;
  margin-left: 0;
`;

const UsersHeading = styled(Heading)`
  display: flex;
  justify-content: center;

  @container (width < ${TABLE_WIDTH_BREAKPOINTS.THIRD}px) {
    display: none;
  }
`;

const NarrowUsersLabel = styled(UsersHeading)`
  display: flex;
  justify-content: space-between;
  width: 60px;
  margin-left: 0;
`;

const AssigneeHeading = styled(Heading)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FOURTH}px) {
    display: none;
  }
`;

const StyledPanel = styled(Panel)`
  container-type: inline-size;
`;

const IssuesWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  justify-content: left;
  margin-bottom: ${space(1.5)};
  margin-top: ${space(1)};

  ${StyledPanel} {
    margin-bottom: 0;
  }
`;

const StyledPanelHeader = styled(PanelHeader)<{hasNewLayout: boolean}>`
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
  ${p =>
    p.hasNewLayout &&
    css`
      text-transform: none;
    `}
`;

const StyledLoadingIndicatorWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: ${space(2)} 0;
  height: 84px;

  /* Add a border between two rows of loading issue states */
  & + & {
    border-top: 1px solid ${p => p.theme.border};
  }
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

const NarrowEventsOrUsersWrapper = styled(UserCountWrapper)`
  margin-left: 0;
  justify-content: center;
`;

const AssigneeWrapper = styled(ColumnWrapper)`
  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FOURTH}px) {
    display: none;
  }
`;

const NarrowAssigneeWrapper = styled(ColumnWrapper)`
  margin-right: ${space(2)};
`;

const ChartWrapper = styled('div')`
  margin-left: ${space(4)};
  width: 200px;
  align-self: center;

  @container (width < ${TABLE_WIDTH_BREAKPOINTS.FIRST}px) {
    display: none;
  }
`;

const StyledLegacyPanelItem = styled(PanelItem)<{hasNewLayout: boolean}>`
  justify-content: space-between;
  align-items: center;
  padding-top: ${p => (p.hasNewLayout ? '0px' : space(1))};
  padding-bottom: ${p => (p.hasNewLayout ? '0px' : space(1))};
  ${p =>
    p.hasNewLayout
      ? css`
          padding: ${space(1)} 0;
          min-height: 66px;
          line-height: 1.1;
        `
      : css`
          height: 84px;
        `}
`;

const StyledPanelItem = styled(StyledLegacyPanelItem)`
  justify-content: left;
  align-items: center;
  gap: ${space(1.5)};
  height: fit-content;
  padding: ${space(1)} ${space(2)};
`;

const StyledIssueStreamHeaderLabel = styled(IssueStreamHeaderLabel)`
  display: flex;
  margin-left: ${space(2)};
  width: 66.66%;
`;

const NarrowIssueSummaryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-left: ${space(2)};
  margin-right: ${space(2)};
  width: 66.66%;
  justify-content: center;
`;
