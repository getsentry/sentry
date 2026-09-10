import {Grid} from '@sentry/scraps/layout';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {HypothesisCard} from 'sentry/views/investigations/hypotheses/hypothesisCard';
import type {InvestigationHypothesis} from 'sentry/views/investigations/types';

/**
 * The narrowest a hypothesis card may get before the row drops to fewer
 * columns. Below roughly this width the statement and its evidence rows stop
 * being scannable.
 */
const MIN_CARD_WIDTH = '260px';

type HypothesisListProps = {
  hypotheses: InvestigationHypothesis[];
  className?: string;
  /**
   * Builds the overflow menu for one hypothesis. Left out, cards render without
   * a menu — which is what a read-only surface wants.
   */
  getActions?: (hypothesis: InvestigationHypothesis) => MenuItemProps[];
  /** `report.primaryHypothesisId` from the projection, if the report has one. */
  primaryHypothesisId?: string | null;
};

/**
 * The hypotheses an agentic investigation is weighing, side by side.
 *
 * The row reflows on the *container's* width rather than the viewport's:
 * `auto-fit` + `minmax` drops to fewer columns whenever the available space
 * stops fitting another readable card. That is what lets the same component sit
 * in a full-width detail view and in a narrow drawer without a breakpoint prop
 * or a `containerType` on the parent.
 */
export function HypothesisList({
  className,
  getActions,
  hypotheses,
  primaryHypothesisId,
}: HypothesisListProps) {
  if (hypotheses.length === 0) {
    return null;
  }

  const ordered = [...hypotheses].sort((a, b) => a.order - b.order);

  return (
    <Grid
      as="ul"
      className={className}
      columns={`repeat(auto-fit, minmax(${MIN_CARD_WIDTH}, 1fr))`}
      gap="md"
      align="start"
      padding="0"
      data-test-id="investigation-hypotheses"
    >
      {ordered.map(hypothesis => (
        <HypothesisCard
          key={hypothesis.id}
          hypothesis={hypothesis}
          isPrimary={hypothesis.id === primaryHypothesisId}
          actions={getActions?.(hypothesis)}
        />
      ))}
    </Grid>
  );
}
