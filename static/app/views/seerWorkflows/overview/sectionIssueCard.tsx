import {LazyRender} from 'sentry/components/lazyRender';
import type {User} from 'sentry/types/user';

import {buildOverviewRow, deriveSectionKey} from './buildOverviewRows';
import {IssueCard, IssueTableRow} from './issueCard';
import type {AutofixStateKey, OverviewIssue, SeerRun} from './types';
import {useIssueAutofixEnrichment} from './useIssueAutofixEnrichment';

const CARD_PLACEHOLDER_HEIGHT = 180;
const TABLE_ROW_PLACEHOLDER_HEIGHT = 48;
const LAZY_OBSERVER_OPTIONS = {rootMargin: '200px 0px'};

function HydratedCard({
  issue,
  orgSlug,
  sectionKey,
  view,
  statsPeriod,
  memberList,
  memberListLoading,
  injectedRun,
  batchPending,
}: {
  // Required so callers must decide explicitly. While a batched runs request is
  // in flight the card waits; once settled it fetches its own run if the batch
  // did not supply one. Callers with no batch pass false.
  batchPending: boolean;
  issue: OverviewIssue;
  orgSlug: string;
  statsPeriod: string;
  view: 'cards' | 'table';
  injectedRun?: SeerRun | null;
  memberList?: User[];
  memberListLoading?: boolean;
  // The server-bucketed section. Absent in focus mode, where the issues
  // endpoint omits issue.autofix_state, so we reconstruct it from enrichment.
  sectionKey?: AutofixStateKey;
}) {
  const {run, state, statePending, enrichmentPending} = useIssueAutofixEnrichment(
    issue.id,
    {injectedRun, batchPending}
  );
  const classificationPending = sectionKey ? statePending : enrichmentPending;
  const row = buildOverviewRow(issue, run, state, classificationPending, statsPeriod);
  const resolvedSectionKey = sectionKey ?? deriveSectionKey(run, state);
  const minHeight = enrichmentPending
    ? `${view === 'cards' ? CARD_PLACEHOLDER_HEIGHT : TABLE_ROW_PLACEHOLDER_HEIGHT}px`
    : undefined;

  return view === 'cards' ? (
    <IssueCard
      row={row}
      orgSlug={orgSlug}
      sectionKey={resolvedSectionKey}
      memberList={memberList}
      memberListLoading={memberListLoading}
      minHeight={minHeight}
    />
  ) : (
    <IssueTableRow
      row={row}
      orgSlug={orgSlug}
      sectionKey={resolvedSectionKey}
      minHeight={minHeight}
    />
  );
}

export function SectionIssueCard({
  lazy = true,
  ...props
}: {
  batchPending: boolean;
  issue: OverviewIssue;
  orgSlug: string;
  statsPeriod: string;
  view: 'cards' | 'table';
  injectedRun?: SeerRun | null;
  lazy?: boolean;
  memberList?: User[];
  memberListLoading?: boolean;
  sectionKey?: AutofixStateKey;
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
