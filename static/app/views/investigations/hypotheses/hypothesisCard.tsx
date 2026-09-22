import styled from '@emotion/styled';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {HypothesisEvidencePlaceholder} from 'sentry/views/investigations/hypotheses/hypothesisPlaceholder';
import {
  getHypothesisCardBorder,
  HypothesisStatus,
} from 'sentry/views/investigations/hypotheses/hypothesisStatus';
import type {InvestigationHypothesis} from 'sentry/views/investigations/types';

/** States where missing checks mean "not yet"; anything else finished without them. */
const PENDING_EVIDENCE_STATUSES = new Set<string>(['pending', 'investigating']);

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
        <EvidenceList
          as="ol"
          padding="0"
          paddingTop="md"
          aria-label={t('Verification steps')}
        >
          {steps.map(step => (
            <EvidenceStep
              key={step.id}
              as="li"
              position="relative"
              paddingLeft="2xl"
              paddingBottom="lg"
              aria-current={step.status === 'running' ? 'step' : undefined}
            >
              <Text
                size="sm"
                density="comfortable"
                variant={step.status === 'running' ? 'primary' : 'muted'}
                wordBreak="break-word"
              >
                {step.title}
              </Text>
            </EvidenceStep>
          ))}
        </EvidenceList>
      ) : null}

      {/* Holds the space for checks that are still on their way. */}
      {steps.length === 0 && PENDING_EVIDENCE_STATUSES.has(hypothesis.effectiveStatus) ? (
        <Stack paddingTop="md">
          <HypothesisEvidencePlaceholder />
        </Stack>
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

const EvidenceList = styled(Stack)`
  list-style: none;
  margin: 0;
`;

const EvidenceStep = styled(Flex)`
  &::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 0;
    width: 10px;
    height: 10px;
    color: ${p => p.theme.tokens.content.secondary};
    border: ${p => p.theme.border.md} solid currentColor;
    border-radius: ${p => p.theme.radius.full};
    background: ${p => p.theme.tokens.background.primary};
    z-index: 1;
  }

  &::after {
    content: '';
    position: absolute;
    top: 8px;
    bottom: -8px;
    left: 4.5px;
    border-left: 1px solid ${p => p.theme.tokens.border.primary};
  }

  &[aria-current='step']::before {
    border-color: ${p => p.theme.tokens.graphics.neutral.vibrant};
    background: ${p => p.theme.tokens.graphics.neutral.vibrant};
  }

  &:last-child {
    padding-bottom: 0;

    &::after {
      display: none;
    }
  }
`;
