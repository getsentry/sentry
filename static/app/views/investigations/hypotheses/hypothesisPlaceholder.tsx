import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

const PLACEHOLDER_EVIDENCE_ROWS = 2;

/** Uneven widths, so the rows read as text rather than a stack of equal bars. */
const EVIDENCE_ROW_WIDTHS = ['92%', '78%', '85%'];

/**
 * The evidence rows of a hypothesis whose checks have not arrived yet. Also
 * used inside a real card, which gets its statement well before its checks.
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
          <Dot />
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
 * One card's worth of reserved space.
 *
 * Not built on `HypothesisCard`'s styled box: that box carries the verdict in
 * its border, and a card holding no hypothesis has no verdict to show.
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
      {/* The hypothesis number and its status. */}
      <Bar height="16px" width="65%" />
      {/* The statement. */}
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

/** `Placeholder` defaults to a card's corner radius, too round at bar height. */
const Bar = styled(Placeholder)`
  border-radius: ${p => p.theme.radius.sm};
`;

/** Where a verification step's status dot will sit. */
function Dot() {
  return <Placeholder shape="circle" height="10px" width="10px" />;
}
