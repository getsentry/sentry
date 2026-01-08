import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

type IssueProps = {
  issue: TraceTree.TraceIssue;
  organization: Organization;
};

const MAX_DISPLAYED_ISSUES_COUNT = 3;

const issueOrderPriority: Record<keyof Theme['level'], number> = {
  fatal: 0,
  error: 1,
  warning: 2,
  sample: 3,
  info: 4,
  default: 5,
  unknown: 6,
};

function sortIssuesByLevel(
  a: TraceTree.TraceErrorIssue,
  b: TraceTree.TraceErrorIssue
): number {
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

  const iconClassName: string =
    props.issue.event_type === 'error' ? props.issue.level : 'occurence';

  return isPending ? (
    <StyledLoadingIndicatorWrapper>
      <LoadingIndicator size={24} mini />
    </StyledLoadingIndicatorWrapper>
  ) : fetchedIssue ? (
    <StyledPanelItem>
      <IconWrapper className={iconClassName}>
        <IconBackground className={iconClassName}>
          <TraceIcons.Icon event={props.issue} />
        </IconBackground>
      </IconWrapper>
      <SummaryWrapper>
        <EventOrGroupHeader data={fetchedIssue} eventId={props.issue.event_id} />
        <EventOrGroupExtraDetails data={fetchedIssue} />
      </SummaryWrapper>
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
  &.occurence {
    border: 1px solid var(--occurence);
    ${IconBackground} {
      background-color: var(--occurence);
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
  &.occurence,
  &.default,
  &.unknown {
    svg {
      transform: translateY(-1px);
    }
  }
`;

const SummaryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  justify-content: left;
`;

type IssueListProps = {
  issues: TraceTree.TraceIssue[];
  node: BaseNode;
  organization: Organization;
};

export function IssueList({issues, node, organization}: IssueListProps) {
  const uniqueIssues = [
    ...node.uniqueErrorIssues.sort(sortIssuesByLevel),
    ...node.uniqueOccurrenceIssues,
  ];

  if (!issues.length) {
    return null;
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

const StyledPanel = styled(Panel)`
  container-type: inline-size;
`;

const IssuesWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  justify-content: left;
  margin: ${space(1)} 0;

  ${StyledPanel} {
    margin-bottom: 0;
  }
`;

const StyledLoadingIndicatorWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: ${space(2)} 0;
  min-height: 76px;

  /* Add a border between two rows of loading issue states */
  & + & {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const StyledLegacyPanelItem = styled(PanelItem)`
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} 0;
  line-height: 1.1;
`;

const StyledPanelItem = styled(StyledLegacyPanelItem)`
  justify-content: left;
  align-items: flex-start;
  gap: ${space(1)};
  height: fit-content;
  padding: ${space(1)} ${space(2)} ${space(1.5)} ${space(1)};
`;
