import type {TooltipComponentFormatterCallbackParams} from 'echarts';

import {escape} from 'sentry/utils';

import {
  CHART_BASELINE_SERIES_NAME,
  CHART_SELECTED_SERIES_NAME,
  CHART_TOOLTIP_MAX_VALUE_LENGTH,
} from './constants';
import {percentageFormatter} from './utils';

export function formatSingleModeTooltip(
  p: TooltipComponentFormatterCallbackParams
): string {
  const data = Array.isArray(p) ? p[0]?.data : p.data;
  const pct = percentageFormatter(Number(data));

  const value = Array.isArray(p) ? p[0]?.name : p.name;
  const truncatedValue = value
    ? value.length > CHART_TOOLTIP_MAX_VALUE_LENGTH
      ? `${value.slice(0, CHART_TOOLTIP_MAX_VALUE_LENGTH)}...`
      : value
    : '\u2014';
  const escapedTruncatedValue = escape(truncatedValue);
  return `
    <div class="tooltip-series" style="padding: 0;">
      <div
        class="tooltip-label"
        style="
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin: 0 auto;
          padding: 8px 15px;
          min-width: 100px;
          cursor: default;
          max-width: 300px;
        "
      >
        <strong
          style="
            word-break: break-word;
            white-space: normal;
            overflow-wrap: anywhere;
          "
        >${escapedTruncatedValue}</strong>
        <span>${pct}</span>
      </div>
    </div>
  `.trim();
}

export function formatComparisonModeTooltip(
  p: TooltipComponentFormatterCallbackParams,
  primaryColor: string,
  secondaryColor: string
): string {
  if (!Array.isArray(p)) {
    return '\u2014';
  }

  const selectedParam = p.find(s => s.seriesName === CHART_SELECTED_SERIES_NAME);
  const baselineParam = p.find(s => s.seriesName === CHART_BASELINE_SERIES_NAME);

  if (!selectedParam || !baselineParam) {
    return '\u2014';
  }

  const selectedValue = selectedParam.value;
  const baselineValue = baselineParam.value;
  const selectedPct = percentageFormatter(Number(selectedValue));
  const baselinePct = percentageFormatter(Number(baselineValue));

  const name = selectedParam.name ?? baselineParam.name ?? '';
  const truncatedName =
    name.length > CHART_TOOLTIP_MAX_VALUE_LENGTH
      ? `${name.slice(0, CHART_TOOLTIP_MAX_VALUE_LENGTH)}...`
      : name;
  const escapedTruncatedName = escape(truncatedName);

  return `
    <div class="tooltip-series" style="padding: 0;">
      <div class="tooltip-label" style="display: flex; flex-direction: column; align-items: stretch; gap: 8px; margin: 0 auto; padding: 8px 15px; min-width: 100px; max-width: 300px; cursor: default;">
        <strong style="word-break: break-word; white-space: normal; overflow-wrap: anywhere; text-align: center;">${escapedTruncatedName}</strong>
        <span style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
          <span style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${primaryColor}; display: inline-block;"></span>
            selected
          </span>
          <span>${selectedPct}</span>
        </span>
        <span style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
          <span style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${secondaryColor}; display: inline-block;"></span>
            baseline
          </span>
          <span>${baselinePct}</span>
        </span>
      </div>
    </div>
  `.trim();
}
