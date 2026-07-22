import {LazyRender} from 'sentry/components/lazyRender';

import {buildOverviewRow, deriveSectionKey} from './buildOverviewRows';
import {IssueCard, IssueTableRow} from './issueCard';
import type {AutofixStateKey, OverviewIssue} from './types';
import {useIssueAutofixEnrichment} from './useIssueAutofixEnrichment';

const CARD_PLACEHOLDER_HEIGHT = 180;
const TABLE_ROW_PLACEHOLDER_HEIGHT = 48;
const LAZY_OBSERVER_OPTIONS = {rootMargin: '200px 0px'};

function HydratedCard({
  defaultExpanded,
  issue,
  orgSlug,
  sectionKey,
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
  // The server-bucketed section. Absent in focus mode, where the issues
  // endpoint omits issue.autofix_state, so we reconstruct it from enrichment.
  sectionKey?: AutofixStateKey;
}) {
  const {run, state, statePending} = useIssueAutofixEnrichment(issue.id);
  const row = buildOverviewRow(issue, run, state, statePending, statsPeriod);
  const resolvedSectionKey = sectionKey ?? deriveSectionKey(run, state);

  return view === 'cards' ? (
    <IssueCard
      row={row}
      orgSlug={orgSlug}
      sectionKey={resolvedSectionKey}
      defaultExpanded={defaultExpanded}
    />
  ) : (
    <IssueTableRow
      row={row}
      orgSlug={orgSlug}
      sectionKey={resolvedSectionKey}
      isLast={isLast ?? false}
    />
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
