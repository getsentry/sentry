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

/**
 * How many cards to hold the space for while the run works toward its first
 * hypothesis.
 *
 * Three is what a run produces: the agent proposes a small handful of
 * explanations, and the row is laid out around that. Reserving fewer would
 * still jump when the real cards land; reserving more would promise a row that
 * never arrives.
 */
const PLACEHOLDER_CARD_COUNT = 3;

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
 * The hypothesis row before there are any hypotheses.
 *
 * There is a real dead window at the start of a run: intake, broad scan and
 * planning all happen before the agent has written a single hypothesis, and
 * that is a good share of a run's opening stretch. Rendering nothing there
 * leaves a blank area under a status block that says work is happening, and
 * then drops the whole row in at once. This puts the shape of what is coming on
 * the page instead, in the row's own grid — so it reflows into the same number
 * of columns the real cards will use, and their arrival does not move anything.
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
