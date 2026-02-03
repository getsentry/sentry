import {t} from 'sentry/locale';
import {escape} from 'sentry/utils';
import type {Theme} from 'sentry/utils/theme';
import type {AttributeDistribution} from 'sentry/views/explore/components/attributeBreakdowns/attributeDistributionContent';
import {Actions} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

import {CHART_AXIS_LABEL_FONT_SIZE, CHART_MAX_SERIES_LENGTH} from './constants';

export function calculateAttributePopulationPercentage(
  values: Array<{
    label: string;
    value: number;
  }>,
  cohortTotal: number
): number {
  if (cohortTotal === 0) return 0;

  const populatedCount = values.reduce((acc, curr) => acc + curr.value, 0);
  return (populatedCount / cohortTotal) * 100;
}

export function percentageFormatter(percentage: number): string {
  if (isNaN(percentage) || !isFinite(percentage)) {
    return '\u2014';
  }

  if (percentage < 0.1 && percentage > 0) {
    return '<0.1%';
  }

  // Round to whole number if we round to a whole number, else use 1 decimal place
  const rounded = percentage.toFixed(1);
  const roundsToWhole = rounded.endsWith('.0') || !rounded.includes('.');

  const decimals = roundsToWhole ? 0 : 1;
  return `${percentage.toFixed(decimals)}%`;
}

export function formatChartXAxisLabel(
  value: string,
  labelsCount: number,
  chartWidth: number
): string {
  // 14px is the width of the y axis label with font size 12
  // We'll subtract side padding (e.g. 4px per label) to avoid crowding
  const labelPadding = 4;
  const pixelsPerLabel = (chartWidth - 14) / labelsCount - labelPadding;

  //  Average width of a character is 0.6 times the font size
  const pixelsPerCharacter = 0.6 * CHART_AXIS_LABEL_FONT_SIZE;

  // Compute the max number of characters that can fit
  const maxChars = Math.floor(pixelsPerLabel / pixelsPerCharacter);

  // If value fits, return it as-is
  if (value.length <= maxChars) return value;

  // Otherwise, truncate and append '…'
  const truncatedLength = Math.max(1, maxChars - 2); // leaving space for (ellipsis)
  return value.slice(0, truncatedLength) + '…';
}

function createActionButton(
  action: Actions,
  label: string,
  escapedAttributeName: string,
  escapedValue: string,
  actionBackground: string
): string {
  return [
    '  <div',
    `    class="attribute-breakdowns-tooltip-action-button"`,
    `    data-tooltip-action="${action}"`,
    `    data-tooltip-action-key="${escapedAttributeName}"`,
    `    data-tooltip-action-value="${escapedValue}"`,
    `    data-hover-background="${actionBackground}"`,
    '    style="width: 100%; padding: 8px 15px; cursor: pointer; text-align: left;"',
    '  >',
    `    ${label}`,
    '  </div>',
  ].join('\n');
}

export function tooltipActionsHtmlRenderer(
  value: string,
  attributeName: string,
  theme: Theme
): string {
  if (!value) return '';

  const escapedAttributeName = escape(attributeName);
  const escapedValue = escape(value);
  const actionBackground = theme.colors.gray200;

  const actions = [
    {action: Actions.GROUP_BY, label: t('Group by attribute')},
    {action: Actions.ADD_TO_FILTER, label: t('Add value to filter')},
    {action: Actions.EXCLUDE_FROM_FILTER, label: t('Exclude value from filter')},
    {action: Actions.COPY_TO_CLIPBOARD, label: t('Copy value to clipboard')},
  ];

  return [
    '<div',
    '  class="tooltip-footer"',
    '  id="tooltipActions"',
    '  style="',
    '    display: flex;',
    '    justify-content: flex-start;',
    '    align-items: flex-start;',
    '    flex-direction: column;',
    '    padding: 0;',
    '    gap: 0;',
    '  "',
    '>',
    ...actions.map(({action, label}) =>
      createActionButton(
        action,
        label,
        escapedAttributeName,
        escapedValue,
        actionBackground
      )
    ),
    '</div>',
  ]
    .join('\n')
    .trim();
}

export function distributionToSeriesData(
  values: AttributeDistribution[number]['values'],
  cohortCount: number
): Array<{label: string; value: number}> {
  return values
    .map(value => ({
      label: value.label,
      value: cohortCount === 0 ? 0 : (value.value / cohortCount) * 100,
    }))
    .slice(0, CHART_MAX_SERIES_LENGTH);
}

/**
 * From the unique labels across both cohorts, we create two series data objects,
 * one for the selected cohort and one for the baseline cohort.
 * If a label isn't present in either of the cohorts, we assign a value of 0 to
 * that label in the respective series. We sort by descending value of the selected cohort.
 */
export function cohortsToSeriesData(
  cohort1: Array<{label: string; value: number}>,
  cohort2: Array<{label: string; value: number}>,
  seriesTotals: {
    baseline: number;
    selected: number;
  }
) {
  const cohort1Map = new Map(cohort1.map(({label, value}) => [label, value]));
  const cohort2Map = new Map(cohort2.map(({label, value}) => [label, value]));

  const uniqueLabels = new Set([...cohort1Map.keys(), ...cohort2Map.keys()]);

  const seriesData = Array.from(uniqueLabels)
    .map(label => {
      const selectedVal = cohort1Map.get(label) ?? 0;
      const baselineVal = cohort2Map.get(label) ?? 0;

      const selectedPercentage =
        seriesTotals.selected > 0 ? (selectedVal / seriesTotals.selected) * 100 : 0;
      const baselinePercentage =
        seriesTotals.baseline > 0 ? (baselineVal / seriesTotals.baseline) * 100 : 0;

      return {
        label,
        selectedValue: selectedPercentage,
        baselineValue: baselinePercentage,
        sortValue: selectedPercentage,
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, CHART_MAX_SERIES_LENGTH);

  const selectedSeriesData: Array<{label: string; value: number}> = [];
  const baselineSeriesData: Array<{label: string; value: number}> = [];

  for (const {label, selectedValue, baselineValue} of seriesData) {
    selectedSeriesData.push({label, value: selectedValue});
    baselineSeriesData.push({label, value: baselineValue});
  }

  return {
    selected: selectedSeriesData,
    baseline: baselineSeriesData,
  };
}
