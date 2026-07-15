import {t} from 'sentry/locale';

import type {AskSeerStep} from './types';

/**
 * Normalize a step key by extracting just the first unique key.
 * Handles comma-separated keys from parallel tool calls (e.g., "get_field_values,get_field_values").
 */
export function normalizeStepKey(step: AskSeerStep): string {
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

// Shared labels for tag/field investigation steps
const TAG_INVESTIGATION_LABELS: StepLabel[] = [
  {loading: t('Investigating your tags...'), completed: t('Investigated tags')},
  {loading: t('Looking for more tags...'), completed: t('Found more tags')},
  {
    loading: t('Checking additional tags...'),
    completed: t('Checked additional tags'),
  },
];

/**
 * Human-readable labels for step keys.
 * Maps the agent's step keys to user-friendly descriptions.
 * Array format allows for variation when steps repeat.
 */
const STEP_LABELS: Record<string, StepLabel[]> = {
  get_field_values: TAG_INVESTIGATION_LABELS,
  get_metric_candidates: [
    {loading: t('Finding matching metrics...'), completed: t('Found matching metrics')},
    {loading: t('Looking for more metrics...'), completed: t('Found more metrics')},
    {
      loading: t('Checking additional metrics...'),
      completed: t('Checked additional metrics'),
    },
  ],
  execute_query: [
    {loading: t('Fine-tuning your query...'), completed: t('Fine-tuned query')},
    {loading: t('Trying another approach...'), completed: t('Tried another approach')},
    {loading: t('Running one more test...'), completed: t('Ran another test')},
  ],
  finalize_queries: [
    {loading: t('Double-checking everything...'), completed: t('All done!')},
  ],
  mark_unsupported: [
    {loading: t('Working through this...'), completed: t('This query is not supported')},
  ],

  // DEPRECATED
  get_errors_field_values: TAG_INVESTIGATION_LABELS,
  fetch_tag_values: TAG_INVESTIGATION_LABELS,
  get_tag_values: TAG_INVESTIGATION_LABELS,
  test_query: [
    {loading: t('Testing your query...'), completed: t('Tested query')},
    {loading: t('Trying another approach...'), completed: t('Tried another approach')},
    {loading: t('Running one more test...'), completed: t('Ran another test')},
  ],
  run_query: [
    {loading: t('Running your query...'), completed: t('Ran query')},
    {loading: t('Running it again...'), completed: t('Ran again')},
    {loading: t('One more time...'), completed: t('Tried once more')},
  ],
  analyze_results: [
    {loading: t('Analyzing what I found...'), completed: t('Analyzed results')},
    {loading: t('Taking a closer look...'), completed: t('Looked closer')},
    {loading: t('Examining the details...'), completed: t('Examined details')},
  ],
  refine_query: [
    {loading: t('Fine-tuning the query...'), completed: t('Refined query')},
    {loading: t('Making some adjustments...'), completed: t('Made adjustments')},
    {loading: t('Tweaking a few things...'), completed: t('Tweaked query')},
  ],
  search_issues: [
    {loading: t('Looking through your issues...'), completed: t('Searched issues')},
    {loading: t('Checking more issues...'), completed: t('Checked more issues')},
  ],
  search_spans: [
    {loading: t('Exploring your traces...'), completed: t('Explored traces')},
    {loading: t('Looking at more traces...'), completed: t('Found more traces')},
  ],
  search_logs: [
    {loading: t('Digging through your logs...'), completed: t('Searched logs')},
    {loading: t('Checking more logs...'), completed: t('Checked more logs')},
  ],
  generate_query: [
    {loading: t('Crafting a query for you...'), completed: t('Generated query')},
    {loading: t('Building another option...'), completed: t('Built another option')},
  ],
  validate_query: [
    {loading: t('Validating your query...'), completed: t('Validated your query')},
    {
      loading: t('Double-checking everything...'),
      completed: t('Double-checked results'),
    },
  ],
  thinking: [
    {loading: t('Thinking...'), completed: t('Thought about it')},
    {loading: t('Hmm, let me think...'), completed: t('Considered options')},
    {loading: t('Working through this...'), completed: t('Worked through it')},
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
 * @param occurrence - How many times this step key has occurred before (0-indexed)
 */
export function formatStep(
  step: AskSeerStep,
  isLoading: boolean,
  occurrence: number
): string {
  const key = normalizeStepKey(step);
  const labelVariants = STEP_LABELS[key];
  if (labelVariants && labelVariants.length > 0) {
    // Use modulo to cycle through variants if we have more occurrences than variants
    const variantIndex = occurrence % labelVariants.length;
    const labels = labelVariants[variantIndex];
    if (labels) {
      return isLoading ? labels.loading : labels.completed;
    }
  }
  // Default formatting for unknown steps
  return formatStepKey(key, isLoading);
}

/**
 * Count occurrences of each step key up to (and excluding) the given index.
 * Uses normalized keys to handle comma-separated parallel calls.
 */
export function countOccurrences(
  steps: AskSeerStep[],
  targetKey: string,
  upToIndex: number
): number {
  let count = 0;
  for (let i = 0; i < upToIndex && i < steps.length; i++) {
    const step = steps[i];
    if (step && normalizeStepKey(step) === targetKey) {
      count++;
    }
  }
  return count;
}

/**
 * Deduplicate consecutive steps with the same key (parallel tool calls).
 * Returns a list of unique steps, collapsing consecutive duplicates.
 * Uses normalized keys to handle comma-separated parallel calls.
 */
export function dedupeConsecutiveSteps(steps: AskSeerStep[]): AskSeerStep[] {
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
