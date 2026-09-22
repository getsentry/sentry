import styled from '@emotion/styled';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ActivityLineList, ActivityLineRow} from 'sentry/components/activityLine/layout';
import {ActivityLineDotMarker} from 'sentry/components/activityLine/marker';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  getHypothesisCardBorder,
  HypothesisStatus,
} from 'sentry/views/investigations/hypotheses/hypothesisStatus';
import type {InvestigationHypothesis} from 'sentry/views/investigations/types';

type HypothesisCardProps = {
  hypothesis: InvestigationHypothesis;
  /**
   * Menu items for the card's overflow menu. The card does not own commands —
   * the surface rendering it decides which of accept, reject, steer, and retry
   * apply, and supplies them here. No menu renders when this is empty.
   */
  actions?: MenuItemProps[];
  /**
   * Whether this is the hypothesis the report leads with
   * (`report.primaryHypothesisId`). It lifts off the page so the conclusion is
   * findable without reading every card. The border says where a hypothesis
   * landed; this says which one the report is built around.
   */
  isPrimary?: boolean;
};

/**
 * One hypothesis in an agentic investigation: what the agent proposed, where it
 * landed, and the checks it ran to get there.
 *
 * The card is presentational and self-contained so it can appear in the
 * investigation detail view, in a monitor alert drawer, or anywhere else a run
 * is summarized. It sizes to its container rather than to the viewport.
 */
export function HypothesisCard({
  actions,
  hypothesis,
  isPrimary = false,
}: HypothesisCardProps) {
  const steps = [...(hypothesis.verificationSteps ?? [])].sort(
    (a, b) => a.order - b.order
  );

  return (
    <Card
      as="li"
      gap="md"
      padding="lg"
      radius="md"
      background="primary"
      data-border={getHypothesisCardBorder(hypothesis.effectiveStatus)}
      data-primary={isPrimary}
      data-test-id="investigation-hypothesis"
    >
      <Flex justify="between" align="center" gap="sm">
        <Flex align="center" gap="md" wrap="wrap" minWidth={0}>
          <HypothesisNumber size="xs" variant="muted" tabular>
            {/* `order` is zero-based in the projection; people count from one. */}
            {t('Hypothesis %s', hypothesis.order + 1)}
          </HypothesisNumber>
          <HypothesisStatus hypothesis={hypothesis} />
        </Flex>
        {actions?.length ? (
          <DropdownMenu
            position="bottom-end"
            usePortal
            triggerProps={{
              size: 'xs',
              variant: 'transparent',
              showChevron: false,
              icon: <IconEllipsis size="xs" />,
              'aria-label': t('Actions for %s', hypothesis.statement),
            }}
            items={actions}
          />
        ) : null}
      </Flex>

      <HypothesisTitle as="h3" size="md" wordBreak="break-word" tabular>
        {hypothesis.statement}
      </HypothesisTitle>
      {hypothesis.rationale ? (
        <HypothesisDescription size="sm" wordBreak="break-word" tabular>
          {hypothesis.rationale}
        </HypothesisDescription>
      ) : null}

      {hypothesis.error ? (
        <Text size="sm" variant="danger" wordBreak="break-word">
          {hypothesis.error.message}
        </Text>
      ) : null}

      {steps.length > 0 ? (
        <EvidenceList as="ol" aria-label={t('Verification steps')}>
          {steps.map(step => {
            const isRunning = step.status === 'running';
            return (
              <ActivityLineRow
                key={step.id}
                as="li"
                aria-current={isRunning ? 'step' : undefined}
              >
                <ActivityLineDotMarker
                  variant={isRunning ? 'vibrant' : 'moderate'}
                  label={step.title}
                />
                <StepTitle column={2} row={1} minWidth={0} minHeight="22px">
                  <Text
                    size="sm"
                    density="comfortable"
                    variant={isRunning ? 'primary' : 'muted'}
                    wordBreak="break-word"
                  >
                    {step.title}
                  </Text>
                </StepTitle>
              </ActivityLineRow>
            );
          })}
        </EvidenceList>
      ) : null}
    </Card>
  );
}

const HypothesisNumber = styled(Text)`
  line-height: 16px;
`;

const HypothesisTitle = styled(Heading)`
  color: ${p => p.theme.tokens.content.headings};
  line-height: 1.2;
`;

const HypothesisDescription = styled(Text)`
  line-height: 16px;
`;

/**
 * The card border carries the verdict, which is why it is CSS rather than the
 * `border` prop: `getBorder` only ever emits `1px solid`, and a hypothesis that
 * has not been established needs a broken edge. The colors still come from
 * border tokens.
 *
 * Both variants are driven by data attributes because `Stack` forwards props it
 * does not recognize to the DOM, where a bare `isPrimary` would land as an
 * unknown attribute.
 */
const Card = styled(Stack)`
  list-style: none;
  border: 1px solid ${p => p.theme.tokens.border.primary};

  /* The explanation that stands. */
  &[data-border='accent'] {
    border-width: 2px;
    border-bottom-width: 3px;
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
  }

  /* Checked, and not the answer: ruled out, inconclusive, failed or cancelled.
   * Dashed rather than dotted because a dotted hairline all but disappears at
   * this border color. A hypothesis still being investigated keeps the solid
   * default above — dashing it would announce a verdict nobody has reached. */
  &[data-border='dashed'] {
    border-style: dashed;
  }

  &[data-primary='true'] {
    box-shadow: ${p => p.theme.shadow.low};
  }
`;

/**
 * The checks as a connected timeline — the same one the issue activity drawer
 * draws, so a hypothesis' progress reads the way activity does everywhere else:
 * a marker per step in a fixed gutter, with a line running between them. Each
 * step is an `ActivityLineRow`, which owns the gutter and the segment of line
 * running to the next step — including stopping it at the last one.
 *
 * `ol` markers would otherwise sit in the card's padding beside each step.
 */
const EvidenceList = styled(ActivityLineList)`
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${p => p.theme.space.md};
`;

// The row's second column, beside the marker — placed rather than left to
// auto-placement, which is what the activity line's own headline does.
//
// A step's title is smaller than an activity headline, so centring it in the
// marker's own 22px box is what puts the two on the same optical line: the
// marker cell is a 22px box lifted 2px, and this matches it. Left to sit in
// its own short line box at the top of the row, the title rides above the dot.
const StepTitle = styled(Flex)`
  align-items: center;
  margin-top: -2px;
`;
