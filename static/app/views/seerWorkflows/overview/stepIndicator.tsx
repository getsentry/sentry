import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  IconBug,
  IconCircle,
  IconCircleCheckmark,
  IconCode,
  IconList,
  IconMerge,
  IconPieHalf,
  IconPieQuarter,
  IconPieThreeQuarters,
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

// Not ProgressMarker: it hardcodes a color per fill level (half = warning,
// three-quarters = success), which would fight the status-driven variant.
const PIE_BY_FILL = [
  IconCircle,
  IconPieQuarter,
  IconPieHalf,
  IconPieThreeQuarters,
  IconCircleCheckmark,
] as const;

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
      {merged && (
        <Text size="xs" bold variant="success" align="left">
          {`✓ ${t('PR merged')}`}
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
 * Where the run is in the autofix pipeline, as a two-glyph unit: a pie fill
 * for how far it got (quarter per stage) and a step icon for which stage
 * that is, tinted by run status. Replaces the issue-level line the cards
 * used to open with — on this page every card is a Seer run, so the run's
 * progress is the fact worth a glance, not the issue's level.
 */
export function StepIndicator({row}: {row: OverviewRow}) {
  if (row.statePending) {
    return (
      <Flex
        align="center"
        flexShrink={0}
        role="img"
        aria-label={t('Autofix status loading')}
      >
        <IconCircle size="sm" variant="muted" aria-hidden />
      </Flex>
    );
  }

  const {variant, statusWord} = deriveStatus(row);
  const furthest = row.outcomes.at(-1);
  // Index against the canonical order rather than counting outcomes: a
  // coding-agent run can skip the solution stage, so the array's length can
  // lag the stage it actually reached.
  const fill = furthest ? STEP_ORDER.indexOf(furthest) + 1 : row.isProcessing ? 1 : 0;
  // A processing run streams its section in before any outcome lands, so an
  // empty run that's running is by definition on the first step.
  const currentStep = furthest ?? (row.isProcessing ? 'root_cause' : undefined);

  const Pie = row.prMerged ? IconCircleCheckmark : (PIE_BY_FILL[fill] ?? IconCircle);
  const StepIcon = row.prMerged ? IconMerge : currentStep && STEP_META[currentStep].Icon;
  const stepLabel = currentStep ? STEP_META[currentStep].label : undefined;

  const ariaLabel = row.prMerged
    ? t('Autofix progress: PR merged')
    : stepLabel
      ? statusWord
        ? t('Autofix progress: %s of 4 steps — %s (%s)', fill, stepLabel, statusWord)
        : t('Autofix progress: %s of 4 steps — %s', fill, stepLabel)
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
      <Flex gap="2xs" align="center" flexShrink={0} role="img" aria-label={ariaLabel}>
        <Pie size="sm" variant={variant} aria-hidden />
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
