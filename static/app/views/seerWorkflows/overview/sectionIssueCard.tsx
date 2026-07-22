import {LazyRender} from 'sentry/components/lazyRender';

import {buildOverviewRow} from './buildOverviewRows';
import {IssueCard, IssueTableRow} from './issueCard';
import type {OverviewIssue} from './types';
import {useIssueAutofixEnrichment} from './useIssueAutofixEnrichment';

const CARD_PLACEHOLDER_HEIGHT = 180;
const TABLE_ROW_PLACEHOLDER_HEIGHT = 48;
const LAZY_OBSERVER_OPTIONS = {rootMargin: '200px 0px'};

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
  const {run, state, statePending} = useIssueAutofixEnrichment(issue.id);
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
