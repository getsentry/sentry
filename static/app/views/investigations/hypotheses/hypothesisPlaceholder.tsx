import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

/** Evidence rows to sketch under a statement. Enough to read as a list. */
const PLACEHOLDER_EVIDENCE_ROWS = 2;

/**
 * Widths for the evidence rows, so the stack reads as lines of text that have
 * not arrived rather than a run of identical bars.
 */
const EVIDENCE_ROW_WIDTHS = ['92%', '78%', '85%'];

/**
 * The evidence rows of a hypothesis whose checks have not arrived yet.
 *
 * Used in two places: inside a placeholder card, and inside a *real* card that
 * has a statement but an empty `verificationSteps`. The second is the more
 * useful of the two — the agent writes a statement well before it has run
 * anything against it, and without this the card renders a statement with
 * nothing under it and then grows a whole section when the first check lands.
 *
 * Decorative, so it is hidden from assistive tech: there is nothing here to
 * read out, and the surface that owns the wait says so instead.
 */
export function HypothesisEvidencePlaceholder({
  rows = PLACEHOLDER_EVIDENCE_ROWS,
}: {
  rows?: number;
}) {
  return (
    <Stack gap="lg" aria-hidden data-test-id="investigation-hypothesis-evidence-pending">
      {Array.from({length: rows}, (_, index) => (
        <Flex key={index} gap="md" align="center">
          {/* Where a step's status dot sits once the step exists. */}
          <Bar shape="circle" height="10px" width="10px" />
          <Bar
            height="12px"
            width={EVIDENCE_ROW_WIDTHS[index % EVIDENCE_ROW_WIDTHS.length]}
          />
        </Flex>
      ))}
    </Stack>
  );
}

/**
 * One card's worth of reserved space: the status line, the statement, and the
 * evidence rows under it.
 *
 * Deliberately not built on `HypothesisCard`'s own styled box. That box carries
 * the verdict in its border — accent for the explanation that stands, dashed
 * for one that was ruled out — and none of those readings apply to a card that
 * holds no hypothesis. The plain border is the right one here, and keeping this
 * self-contained is also what keeps the card free to import these rows.
 */
export function HypothesisCardPlaceholder() {
  return (
    <PlaceholderCard
      as="li"
      gap="md"
      padding="lg"
      radius="md"
      border="primary"
      background="primary"
      aria-hidden
      data-test-id="investigation-hypothesis-placeholder"
    >
      {/* The "Hypothesis N" label and the status chip beside it. */}
      <Bar height="16px" width="65%" />
      {/* The statement, the tallest line in a real card. */}
      <Bar height="20px" width="100%" />
      <Stack paddingTop="md">
        <HypothesisEvidencePlaceholder />
      </Stack>
    </PlaceholderCard>
  );
}

// `ul` markers would otherwise sit in the grid's gutter beside each card.
const PlaceholderCard = styled(Stack)`
  list-style: none;
`;

/**
 * `Placeholder` defaults to a card's corner radius, which at bar height reads
 * as a stack of little cards rather than as text that has not loaded. The
 * circle keeps its own radius — the override would square the status dot.
 */
const Bar = styled(Placeholder)`
  border-radius: ${p => (p.shape === 'circle' ? '100%' : p.theme.radius.sm)};
`;
