import {t} from 'sentry/locale';
import type {MetricsExtractionRule} from 'sentry/types/metrics';
import {DEFAULT_SPAN_METRIC_ALERT_FIELD, parseField} from 'sentry/utils/metrics/mri';

export function getFormattedSpanMetricField(
  field: string,
  metricExtractionRules: MetricsExtractionRule[] | null | undefined
): string {
  let formattedAggregate =
    field === DEFAULT_SPAN_METRIC_ALERT_FIELD ? t('Select a metrics to continue') : '...';

  const parsedField = parseField(field);
  if (metricExtractionRules && parsedField) {
    const matchedRule = metricExtractionRules.find(extractionRule =>
      extractionRule.conditions.some(condition =>
        condition.mris.includes(parsedField.mri)
      )
    );

    if (matchedRule) {
      const aggregationToDisplay =
        // Internally we use `sum` for counter metrics but expose `count` to the user
        parsedField.aggregation === 'sum' ? 'count' : parsedField.aggregation;
      formattedAggregate = `${aggregationToDisplay}(${matchedRule.spanAttribute})`;
    } else {
      t('Deleted metric');
    }
  }

  return formattedAggregate;
}
