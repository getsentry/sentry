import {useQuery} from '@tanstack/react-query';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {LazyRender} from 'sentry/components/lazyRender';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {RunQuestion} from 'sentry/views/autofixIssuesDemo/useAutofixIssues';

import {buildOverviewRow} from './buildOverviewRows';
import {IssueCard, IssueTableRow} from './issueCard';
import {RUN_QUESTION_PROMPTS} from './runQuestions';
import {QUERY_STALE_TIME} from './types';
import type {OverviewIssue} from './useAutofixSections';

const RUNS_QUERY = 'type:explorer source:autofix';
const CARD_PLACEHOLDER_HEIGHT = 180;
const TABLE_ROW_PLACEHOLDER_HEIGHT = 48;
const LAZY_OBSERVER_OPTIONS = {rootMargin: '200px 0px'};

interface SectionRun {
  groupId: string | null;
  id: string;
  lastTriggeredAt: string;
  source: string | null;
  outputs?: RunQuestion[];
  pullRequests?: Array<{status: string | null}>;
}

function useIssueCardContent(issueId: string) {
  const organization = useOrganization();

  const runsQuery = useQuery({
    ...apiOptions.as<SectionRun[]>()('/organizations/$organizationIdOrSlug/seer/runs/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        query: `${RUNS_QUERY} group:${issueId}`,
        question: RUN_QUESTION_PROMPTS,
        per_page: 1,
      },
      staleTime: QUERY_STALE_TIME,
    }),
  });

  const stateQuery = useQuery({
    ...apiOptions.as<{autofix: ExplorerAutofixState | null}>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
      {
        path: {organizationIdOrSlug: organization.slug, issueId},
        query: {mode: 'explorer'},
        staleTime: QUERY_STALE_TIME,
      }
    ),
  });

  return {
    run: runsQuery.data?.find(run => run.groupId === issueId) ?? null,
    state: stateQuery.data?.autofix ?? null,
    statePending: stateQuery.isPending,
  };
}

function HydratedCard({
  defaultExpanded,
  issue,
  orgSlug,
  view,
  statsPeriod,
  isLast,
}: {
  issue: OverviewIssue;
  orgSlug: string;
  statsPeriod: string;
  view: 'cards' | 'table';
  defaultExpanded?: boolean;
  isLast?: boolean;
}) {
  const {run, state, statePending} = useIssueCardContent(issue.id);
  const row = buildOverviewRow(issue, run, state, statePending, statsPeriod);

  return view === 'cards' ? (
    <IssueCard row={row} orgSlug={orgSlug} defaultExpanded={defaultExpanded} />
  ) : (
    <IssueTableRow row={row} orgSlug={orgSlug} isLast={isLast ?? false} />
  );
}

export function SectionIssueCard({
  lazy = true,
  ...props
}: {
  issue: OverviewIssue;
  orgSlug: string;
  statsPeriod: string;
  view: 'cards' | 'table';
  defaultExpanded?: boolean;
  isLast?: boolean;
  lazy?: boolean;
}) {
  return (
    <LazyRender
      disabled={!lazy}
      containerHeight={
        props.view === 'cards' ? CARD_PLACEHOLDER_HEIGHT : TABLE_ROW_PLACEHOLDER_HEIGHT
      }
      observerOptions={LAZY_OBSERVER_OPTIONS}
      withoutContainer
    >
      <HydratedCard {...props} />
    </LazyRender>
  );
}
