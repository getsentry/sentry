import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {HypothesisCard} from 'sentry/views/investigations/hypotheses/hypothesisCard';
import {HypothesisCardPlaceholder} from 'sentry/views/investigations/hypotheses/hypothesisPlaceholder';
import type {InvestigationHypothesis} from 'sentry/views/investigations/types';

/**
 * The narrowest a hypothesis card may get before the row drops to fewer
 * columns. Below roughly this width the statement and its evidence rows stop
 * being scannable.
 */
const MIN_CARD_WIDTH = '260px';

/** Hold space with a single card rather than guessing how many a run will produce. */
const PLACEHOLDER_CARD_COUNT = 1;

/** The grid props shared by the real row and its placeholder. */
const ROW_LAYOUT = {
  as: 'ul',
  columns: `repeat(auto-fit, minmax(${MIN_CARD_WIDTH}, 1fr))`,
  gap: 'xl',
  align: 'start',
  padding: '0',
} as const;

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
 * The hypothesis row before the agent has written any hypotheses. Uses the
 * row's own column sizing, but `auto-fill` keeps the empty tracks so a lone
 * card stays one column wide instead of stretching across the row.
 */
export function HypothesisListPlaceholder({
  cards = PLACEHOLDER_CARD_COUNT,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <Grid
      {...ROW_LAYOUT}
      columns={`repeat(auto-fill, minmax(${MIN_CARD_WIDTH}, 1fr))`}
      className={className}
      aria-busy
      aria-label={t('Loading possible causes')}
      data-test-id="investigation-hypotheses-placeholder"
    >
      {Array.from({length: cards}, (_, index) => (
        <HypothesisCardPlaceholder key={index} />
      ))}
    </Grid>
  );
}

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
    <Grid {...ROW_LAYOUT} className={className} data-test-id="investigation-hypotheses">
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
