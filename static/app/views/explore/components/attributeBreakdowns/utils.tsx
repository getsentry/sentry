import {t} from 'sentry/locale';
import {escape} from 'sentry/utils';
import type {Theme} from 'sentry/utils/theme';
import {Actions} from 'sentry/views/explore/hooks/useAttributeBreakdownsTooltip';

import {CHART_AXIS_LABEL_FONT_SIZE} from './constants';

export function calculateAttrubutePopulationPercentage(
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
