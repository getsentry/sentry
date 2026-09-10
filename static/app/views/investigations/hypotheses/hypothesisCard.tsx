import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  getHypothesisCardBorder,
  getVerificationStepStatusLabel,
  HypothesisStatus,
} from 'sentry/views/investigations/hypotheses/hypothesisStatus';
import type {
  InvestigationHypothesis,
  InvestigationVerificationStep,
} from 'sentry/views/investigations/types';

type HypothesisCardProps = {
  hypothesis: InvestigationHypothesis;
  /**
   * Menu items for the card's overflow menu. The card does not own commands —
   * the surface rendering it decides which of accept, reject, steer, and retry
   * apply, and supplies them here. No menu renders when this is empty.
   */
  actions?: MenuItemProps[];
  className?: string;
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
  className,
  hypothesis,
  isPrimary = false,
}: HypothesisCardProps) {
  const steps = [...(hypothesis.verificationSteps ?? [])].sort(
    (a, b) => a.order - b.order
  );

  return (
    <Card
      as="li"
      className={className}
      gap="md"
      padding="lg"
      radius="md"
      background="primary"
      data-border={getHypothesisCardBorder(hypothesis.effectiveStatus)}
      data-primary={isPrimary}
      data-test-id="investigation-hypothesis"
    >
      <Flex justify="between" align="start" gap="sm">
        <Stack gap="xs">
          <Text size="xs" variant="muted">
            {/* `order` is zero-based in the projection; people count from one. */}
            {t('Hypothesis %s', hypothesis.order + 1)}
          </Text>
          <HypothesisStatus hypothesis={hypothesis} />
        </Stack>
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

      <Stack gap="xs">
        <Heading as="h3" size="md">
          {hypothesis.statement}
        </Heading>
        {hypothesis.rationale ? (
          <Text size="sm" variant="muted" density="comfortable">
            {hypothesis.rationale}
          </Text>
        ) : null}
      </Stack>

      {hypothesis.error ? (
        <Text size="sm" variant="danger">
          {hypothesis.error.message}
        </Text>
      ) : null}

      {steps.length > 0 ? (
        <Stack gap="sm">
          <Text size="sm" bold>
            {t('Evidence checked')}
          </Text>
          <EvidenceList as="ul" gap="xs" padding="0">
            {steps.map(step => (
              <VerificationStepRow key={step.id} step={step} />
            ))}
          </EvidenceList>
        </Stack>
      ) : null}
    </Card>
  );
}

function VerificationStepRow({step}: {step: InvestigationVerificationStep}) {
  const failed = step.status === 'failed';
  // A step's own error is more specific than the generic failure label, so it
  // wins when both are present.
  const detail =
    step.result || step.error?.message || getVerificationStepStatusLabel(step.status);

  return (
    <Container
      as="li"
      border={failed ? 'danger' : 'primary'}
      radius="sm"
      padding="sm md"
      background="secondary"
    >
      <Stack gap="2xs">
        <Text size="sm">{step.title}</Text>
        <Text size="xs" variant={failed ? 'danger' : 'muted'} density="comfortable">
          {detail}
        </Text>
      </Stack>
    </Container>
  );
}

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
    border-color: ${p => p.theme.tokens.border.accent.vibrant};
  }

  /* Not the answer: still running, ruled out, inconclusive, or failed. Dashed
   * rather than dotted because a dotted hairline all but disappears at this
   * border color. */
  &[data-border='dashed'] {
    border-style: dashed;
  }

  &[data-primary='true'] {
    box-shadow: ${p => p.theme.shadow.low};
  }
`;

// `ul` markers would otherwise sit in the card's padding next to each step.
const EvidenceList = styled(Stack)`
  list-style: none;
`;
