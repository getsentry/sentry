import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {space} from 'sentry/styles/space';

import type {AskSeerStep} from './types';

/**
 * Normalize a step key by extracting just the first unique key.
 * Handles comma-separated keys from parallel tool calls (e.g., "get_field_values,get_field_values").
 */
function normalizeStepKey(step: AskSeerStep): string {
  if (!step.key.includes(',')) {
    return step.key;
  }
  // Take the first key from comma-separated parallel calls
  const firstKey = step.key.split(',')[0]?.trim();
  return firstKey || step.key;
}

interface StepLabel {
  completed: string;
  loading: string;
}

/**
 * Human-readable labels for step keys.
 * Maps the agent's step keys to user-friendly descriptions.
 * Array format allows for variation when steps repeat.
 */
const STEP_LABELS: Record<string, StepLabel[]> = {
  fetch_tag_values: [
    {loading: 'Investigating your tags...', completed: 'Investigated tags'},
    {loading: 'Looking at more tags...', completed: 'Checked more tags'},
    {loading: 'Checking additional tags...', completed: 'Found more tags'},
  ],
  get_field_values: [
    {loading: 'Investigating your tags...', completed: 'Investigated tags'},
    {loading: 'Looking at more tags...', completed: 'Checked more tags'},
    {loading: 'Checking additional tags...', completed: 'Found more tags'},
  ],
  get_tag_values: [
    {loading: 'Investigating your tags...', completed: 'Investigated tags'},
    {loading: 'Looking at more tags...', completed: 'Checked more tags'},
    {loading: 'Checking additional tags...', completed: 'Found more tags'},
  ],
  get_errors_field_values: [
    {loading: 'Investigating your tags...', completed: 'Investigated tags'},
    {loading: 'Looking at more tags...', completed: 'Checked more tags'},
    {loading: 'Checking additional tags...', completed: 'Found more tags'},
  ],
  test_query: [
    {loading: 'Testing your query...', completed: 'Tested query'},
    {loading: 'Trying another approach...', completed: 'Tried another approach'},
    {loading: 'Running one more test...', completed: 'Ran another test'},
  ],
  run_query: [
    {loading: 'Running your query...', completed: 'Ran query'},
    {loading: 'Running it again...', completed: 'Ran again'},
    {loading: 'One more time...', completed: 'Tried once more'},
  ],
  analyze_results: [
    {loading: 'Analyzing what I found...', completed: 'Analyzed results'},
    {loading: 'Taking a closer look...', completed: 'Looked closer'},
    {loading: 'Examining the details...', completed: 'Examined details'},
  ],
  refine_query: [
    {loading: 'Fine-tuning the query...', completed: 'Refined query'},
    {loading: 'Making some adjustments...', completed: 'Made adjustments'},
    {loading: 'Tweaking a few things...', completed: 'Tweaked query'},
  ],
  search_issues: [
    {loading: 'Looking through your issues...', completed: 'Searched issues'},
    {loading: 'Checking more issues...', completed: 'Checked more issues'},
  ],
  search_spans: [
    {loading: 'Exploring your traces...', completed: 'Explored traces'},
    {loading: 'Looking at more traces...', completed: 'Found more traces'},
  ],
  search_logs: [
    {loading: 'Digging through your logs...', completed: 'Searched logs'},
    {loading: 'Checking more logs...', completed: 'Checked more logs'},
  ],
  generate_query: [
    {loading: 'Crafting a query for you...', completed: 'Generated query'},
    {loading: 'Building another option...', completed: 'Built another option'},
  ],
  validate_query: [
    {loading: 'Validating your query...', completed: 'Validated your query'},
    {loading: 'Double-checking everything...', completed: 'Double-checked results'},
  ],
  thinking: [
    {loading: 'Thinking...', completed: 'Thought about it'},
    {loading: 'Hmm, let me think...', completed: 'Considered options'},
    {loading: 'Working through this...', completed: 'Worked through it'},
  ],
};

/**
 * Convert a step key to a grammatically correct phrase.
 * e.g., "get_field_values" -> "Getting field values"
 *       "search_spans" -> "Searching spans"
 */
function formatStepKey(key: string, isLoading: boolean): string {
  const words = key.split('_');
  const verb = words[0];
  if (!verb) {
    return key;
  }

  const rest = words.slice(1).join(' ');

  if (isLoading) {
    // Convert verb to -ing form
    let ingVerb = verb;
    if (verb.endsWith('e') && !verb.endsWith('ee')) {
      ingVerb = verb.slice(0, -1) + 'ing';
    } else if (verb.match(/[aeiou][^aeiou]$/)) {
      // Double consonant for short vowel + consonant (e.g., run -> running)
      ingVerb = verb + verb.slice(-1) + 'ing';
    } else {
      ingVerb = verb + 'ing';
    }
    // Capitalize first letter
    ingVerb = ingVerb.charAt(0).toUpperCase() + ingVerb.slice(1);
    return rest ? `${ingVerb} ${rest}...` : `${ingVerb}...`;
  }

  // For completed state, capitalize first letter
  const capitalized = verb.charAt(0).toUpperCase() + verb.slice(1);
  return rest ? `${capitalized} ${rest}` : capitalized;
}

/**
 * Format a step for display.
 * @param step - The step to format
 * @param isLoading - Whether the step is currently in progress
 * @param occurrence - Which occurrence of this step (0-indexed)
 */
function formatStep(step: AskSeerStep, isLoading: boolean, occurrence: number): string {
  const key = normalizeStepKey(step);
  const labelVariants = STEP_LABELS[key];
  if (labelVariants && labelVariants.length > 0) {
    // Use modulo to cycle through variants if we have more occurrences than variants
    const variantIndex = Math.min(occurrence, labelVariants.length - 1);
    const labels = labelVariants[variantIndex];
    if (labels) {
      return isLoading ? labels.loading : labels.completed;
    }
  }
  // Default formatting for unknown steps
  return formatStepKey(key, isLoading);
}

interface AskSeerProgressBlocksProps {
  completedSteps: AskSeerStep[];
  currentStep: AskSeerStep | null;
}

/**
 * Count occurrences of each step key up to (and including) the given index.
 * Uses normalized keys to handle comma-separated parallel calls.
 */
function countOccurrences(
  steps: AskSeerStep[],
  targetKey: string,
  upToIndex: number
): number {
  let count = 0;
  for (let i = 0; i <= upToIndex && i < steps.length; i++) {
    const step = steps[i];
    if (step && normalizeStepKey(step) === targetKey) {
      count++;
    }
  }
  return count - 1; // 0-indexed occurrence
}

/**
 * Deduplicate consecutive steps with the same key (parallel tool calls).
 * Returns a list of unique steps, collapsing consecutive duplicates.
 * Uses normalized keys to handle comma-separated parallel calls.
 */
function dedupeConsecutiveSteps(steps: AskSeerStep[]): AskSeerStep[] {
  const result: AskSeerStep[] = [];
  for (const step of steps) {
    const lastStep = result[result.length - 1];
    const currentKey = normalizeStepKey(step);
    const lastKey = lastStep ? normalizeStepKey(lastStep) : null;
    if (lastKey !== currentKey) {
      result.push(step);
    }
  }
  return result;
}

/**
 * Component to display progress steps from the search agent.
 * Shows completed and in-progress steps.
 */
export function AskSeerProgressBlocks({
  completedSteps,
  currentStep,
}: AskSeerProgressBlocksProps) {
  // Dedupe consecutive steps (parallel tool calls show as single step)
  const dedupedSteps = dedupeConsecutiveSteps(completedSteps);

  // Don't render if no steps to show
  if (dedupedSteps.length === 0 && !currentStep) {
    return null;
  }

  // Don't show current step if it's the same as the last completed step
  const lastCompletedStep = dedupedSteps[dedupedSteps.length - 1];
  const currentStepKey = currentStep ? normalizeStepKey(currentStep) : null;
  const lastCompletedKey = lastCompletedStep ? normalizeStepKey(lastCompletedStep) : null;
  const showCurrentStep = currentStep && currentStepKey !== lastCompletedKey;

  // Count how many times the current step's key has appeared in deduped completed steps
  const currentStepOccurrence =
    currentStep && showCurrentStep && currentStepKey
      ? dedupedSteps.filter(s => normalizeStepKey(s) === currentStepKey).length
      : 0;

  return (
    <ProgressContainer>
      {dedupedSteps.map((step, idx) => {
        const normalizedKey = normalizeStepKey(step);
        const occurrence = countOccurrences(dedupedSteps, normalizedKey, idx);
        return (
          <ProgressItem key={`${normalizedKey}-${idx}`}>
            <CompletedDot />
            <Text variant="muted">{formatStep(step, false, occurrence)}</Text>
          </ProgressItem>
        );
      })}
      {showCurrentStep && (
        <ProgressItem>
          <LoadingDot />
          <Text>{formatStep(currentStep, true, currentStepOccurrence)}</Text>
        </ProgressItem>
      )}
    </ProgressContainer>
  );
}

const ProgressContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ProgressItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CompletedDot = styled('div')`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.content.success};
`;

const LoadingDot = styled('div')`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.content.promotion};
  animation: blink 1s infinite;

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0.3;
    }
  }
`;
