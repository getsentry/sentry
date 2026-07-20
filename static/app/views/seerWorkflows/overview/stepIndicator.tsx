import {keyframes, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ProgressRing} from 'sentry/components/progressRing';
import {
  IconBug,
  IconCircleCheckmark,
  IconCode,
  IconList,
  IconMerge,
  IconPullRequest,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

import type {AutofixOutcome, OverviewRow} from './types';

const STEP_ORDER: AutofixOutcome[] = [
  'root_cause',
  'solution',
  'code_changes',
  'pr_opened',
];

// Same icon vocabulary as the Seer drawer's v3 cards, so the glyph on the
// card matches the section the user lands on after clicking through.
const STEP_META: Record<
  AutofixOutcome,
  {Icon: React.ComponentType<SVGIconProps>; label: string}
> = {
  root_cause: {Icon: IconBug, label: t('Root cause')},
  solution: {Icon: IconList, label: t('Plan')},
  code_changes: {Icon: IconCode, label: t('Code changes')},
  pr_opened: {Icon: IconPullRequest, label: t('PR opened')},
};

// The pipeline is five steps with merge as the finale, so the progress
// glyph is a ring filled in fifths (the pie icons only come in quarters,
// which would misread PR-opened as done). The checkmark is reserved for
// the merged PR. Matches the icons' size="sm".
const RING_SIZE = 14;
const RING_BAR_WIDTH = 2;
const TOTAL_STEPS = STEP_ORDER.length + 1;

type IndicatorVariant = 'accent' | 'danger' | 'muted' | 'success' | 'warning';

function deriveStatus(row: OverviewRow): {
  variant: IndicatorVariant;
  statusWord?: string;
} {
  if (row.isProcessing) {
    return {variant: 'accent', statusWord: t('Running')};
  }
  if (row.autofixRunStatus === 'NEED_MORE_INFORMATION') {
    return {variant: 'warning', statusWord: t('Needs your input')};
  }
  if (row.autofixRunStatus === 'ERROR') {
    return {variant: 'danger', statusWord: t('Errored')};
  }
  if (row.prMerged) {
    return {variant: 'success'};
  }
  return {variant: 'muted'};
}

function StepChecklist({
  fill,
  merged,
  statusWord,
  variant,
}: {
  fill: number;
  merged: boolean;
  statusWord: string | undefined;
  variant: IndicatorVariant;
}) {
  return (
    <Stack gap="2xs" align="stretch">
      {STEP_ORDER.map((step, index) => {
        const {label} = STEP_META[step];
        if (index === fill - 1 && statusWord && !merged) {
          return (
            <Text key={step} size="xs" bold variant={variant} align="left">
              {`${label} — ${statusWord}`}
            </Text>
          );
        }
        if (index < fill || merged) {
          return (
            <Text key={step} size="xs" variant="success" align="left">
              {`✓ ${label}`}
            </Text>
          );
        }
        return (
          <Text key={step} size="xs" variant="muted" align="left">
            {`○ ${label}`}
          </Text>
        );
      })}
      {merged ? (
        <Text size="xs" bold variant="success" align="left">
          {`✓ ${t('Merged')}`}
        </Text>
      ) : (
        <Text size="xs" variant="muted" align="left">
          {`○ ${t('Merged')}`}
        </Text>
      )}
      {fill === 0 && statusWord && (
        <Text size="xs" bold variant={variant} align="left">
          {statusWord}
        </Text>
      )}
    </Stack>
  );
}

/**
 * Where the run is in the autofix pipeline, as a two-glyph unit: a progress
 * ring filled a fifth per step and a step icon for which step that is,
 * tinted by run status. Replaces the issue-level line the cards used to
 * open with — on this page every card is a Seer run, so the run's progress
 * is the fact worth a glance, not the issue's level.
 */
export function StepIndicator({row}: {row: OverviewRow}) {
  const theme = useTheme();

  if (row.statePending) {
    return (
      <Flex
        align="center"
        flexShrink={0}
        role="img"
        aria-label={t('Autofix status loading')}
      >
        <ProgressRing
          value={0}
          maxValue={TOTAL_STEPS}
          size={RING_SIZE}
          barWidth={RING_BAR_WIDTH}
          aria-hidden
        />
      </Flex>
    );
  }

  const {variant, statusWord} = deriveStatus(row);
  // Same variant → color resolution the icons use (svgIcon.tsx), so the
  // ring and the step icon beside it always agree.
  const ringColor =
    variant === 'warning'
      ? theme.tokens.graphics.warning.vibrant
      : theme.tokens.content[variant === 'muted' ? 'secondary' : variant];
  const furthest = row.outcomes.at(-1);
  // Index against the canonical order rather than counting outcomes: a
  // coding-agent run can skip the solution stage, so the array's length can
  // lag the stage it actually reached.
  const fill = furthest ? STEP_ORDER.indexOf(furthest) + 1 : row.isProcessing ? 1 : 0;
  // A processing run streams its section in before any outcome lands, so an
  // empty run that's running is by definition on the first step.
  const currentStep = furthest ?? (row.isProcessing ? 'root_cause' : undefined);

  const StepIcon = row.prMerged ? IconMerge : currentStep && STEP_META[currentStep].Icon;
  const stepLabel = currentStep ? STEP_META[currentStep].label : undefined;

  const ariaLabel = row.prMerged
    ? t('Autofix progress: 5 of 5 steps — PR merged')
    : stepLabel
      ? statusWord
        ? t('Autofix progress: %s of 5 steps — %s (%s)', fill, stepLabel, statusWord)
        : t('Autofix progress: %s of 5 steps — %s', fill, stepLabel)
      : t('Autofix progress: no steps completed');

  return (
    <Tooltip
      title={
        <StepChecklist
          fill={fill}
          merged={row.prMerged}
          statusWord={statusWord}
          variant={variant}
        />
      }
      skipWrapper
    >
      {/* Tighter gap inside the pair than between the pair and the title,
          so the two glyphs read as one unit rather than three loose marks. */}
      <Flex gap="xs" align="center" flexShrink={0} role="img" aria-label={ariaLabel}>
        {row.prMerged ? (
          <IconCircleCheckmark size="sm" variant="success" aria-hidden />
        ) : (
          <ProgressRing
            value={fill}
            maxValue={TOTAL_STEPS}
            size={RING_SIZE}
            barWidth={RING_BAR_WIDTH}
            progressColor={ringColor}
            progressEndcaps="round"
            aria-hidden
          />
        )}
        {StepIcon &&
          (row.isProcessing ? (
            <PulseSpan>
              <StepIcon size="sm" variant={variant} aria-hidden />
            </PulseSpan>
          ) : (
            <StepIcon size="sm" variant={variant} aria-hidden />
          ))}
      </Flex>
    </Tooltip>
  );
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const PulseSpan = styled('span')`
  display: inline-flex;
  line-height: 0;
  animation: ${pulse} 2s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
