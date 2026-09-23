import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Timeline} from 'sentry/components/timeline';
import {IconChevron, IconEllipsis} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {HypothesisEvidencePlaceholder} from 'sentry/views/investigations/hypotheses/hypothesisPlaceholder';
import {
  getHypothesisCardBorder,
  HypothesisStatus,
} from 'sentry/views/investigations/hypotheses/hypothesisStatus';
import type {InvestigationHypothesis} from 'sentry/views/investigations/types';

/** States where missing checks mean "not yet"; anything else finished without them. */
const PENDING_EVIDENCE_STATUSES = new Set<string>(['pending', 'investigating']);

/** Past this many checks, only the latest shows until the rest are asked for. */
const MAX_UNCOLLAPSED_STEPS = 2;

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
  const theme = useTheme();
  const [showAllSteps, setShowAllSteps] = useState(false);
  const steps = [...(hypothesis.verificationSteps ?? [])].sort(
    (a, b) => a.order - b.order
  );
  const isCollapsible = steps.length > MAX_UNCOLLAPSED_STEPS;
  // Collapsed, the latest check stands in for the rest: it is where the agent
  // is, or where it ended up.
  const visibleSteps = isCollapsible && !showAllSteps ? steps.slice(-1) : steps;
  const hiddenStepCount = steps.length - visibleSteps.length;
  const dotColorConfig = {
    icon: theme.tokens.graphics.neutral.moderate,
    iconBorder: 'transparent',
    title: theme.tokens.content.primary,
  };

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
          {isCollapsible ? (
            <Timeline.Item
              as="li"
              icon={<Timeline.Dot />}
              colorConfig={dotColorConfig}
              title={
                <Button
                  variant="link"
                  aria-expanded={showAllSteps}
                  onClick={() => setShowAllSteps(value => !value)}
                >
                  <Flex as="span" align="center" gap="xs">
                    <StepTitle size="sm" variant="muted" bold={false}>
                      {showAllSteps
                        ? t('Show less')
                        : tn('Show %s more step', 'Show %s more steps', hiddenStepCount)}
                    </StepTitle>
                    <IconChevron
                      size="xs"
                      variant="muted"
                      direction={showAllSteps ? 'up' : 'right'}
                    />
                  </Flex>
                </Button>
              }
            />
          ) : null}
          {visibleSteps.map(step => {
            const isRunning = step.status === 'running';
            return (
              <Timeline.Item
                key={step.id}
                as="li"
                aria-current={isRunning ? 'step' : undefined}
                icon={<Timeline.Dot />}
                colorConfig={{
                  ...dotColorConfig,
                  // The step the agent is on is picked out; the rest are
                  // markers on the way there.
                  icon: isRunning
                    ? theme.tokens.graphics.neutral.vibrant
                    : theme.tokens.graphics.neutral.moderate,
                }}
                title={
                  // A check reads as a line of evidence rather than a heading,
                  // so it keeps the card's smaller, lighter type instead of the
                  // timeline's bold default.
                  <StepTitle
                    size="sm"
                    bold={false}
                    variant={isRunning ? 'primary' : 'muted'}
                    wordBreak="break-word"
                  >
                    {step.title}
                  </StepTitle>
                }
              />
            );
          })}
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

/**
 * The checks as a connected timeline — the same `Timeline` the breadcrumbs and
 * open periods draw, with a dot marker instead of an icon. `ol` markers would
 * otherwise sit in the card's padding beside each step.
 */
const EvidenceList = styled(Timeline.Container)`
  list-style: none;
  padding: 0;
  /* Margin, not padding: the connecting line is drawn down the container's box,
   * so padding here would show a stub of it above the first marker. */
  margin: ${p => p.theme.space.md} 0 0;
`;

/**
 * A check's title is smaller than the timeline's own, which is sized for a
 * heading. Holding its line box at the marker's height — the 20px icon box plus
 * its 1px ring — keeps the two centred on each other. Left to its shorter
 * natural line box, the title rides above the dot.
 */
const StepTitle = styled(Text)`
  line-height: 22px;
`;
