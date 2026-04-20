import {useCallback, useContext} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {FormContext} from 'sentry/components/forms/formContext';
import {t} from 'sentry/locale';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {MetricsAggregateDropdown} from 'sentry/views/detectors/components/forms/metric/traceMetrics/metricsAggregateDropdown';
import {MetricsMetricSelector} from 'sentry/views/detectors/components/forms/metric/traceMetrics/metricsMetricSelector';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';

/**
 * Trace metrics-specific visualize component for the detector form.
 * Composes the reusable metric selector and aggregate dropdown, wiring each
 * to the detector form's `aggregateFunction` field.
 */
export function MetricsVisualize() {
  const formContext = useContext(FormContext);
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);

  const {aggregation, traceMetric} = parseMetricAggregate(aggregateFunction ?? '');

  const updateFormAggregate = useCallback(
    (newAggregate: string) => {
      formContext.form?.setValue(
        METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
        newAggregate
      );
    },
    [formContext.form]
  );

  const handleMetricChange = useCallback(
    (newMetric: TraceMetric) => {
      // When the metric changes, reset the aggregation to the first operation
      // valid for the new metric's type.
      const normalizedType = newMetric.type?.toLowerCase() ?? '';
      const validOperations = OPTIONS_BY_TYPE[normalizedType] ?? [];
      const nextAggregation = validOperations[0]?.value ?? 'avg';
      updateFormAggregate(
        makeMetricsAggregate({aggregate: nextAggregation, traceMetric: newMetric})
      );
    },
    [updateFormAggregate]
  );

  const handleAggregationChange = useCallback(
    (nextAggregation: string) => {
      updateFormAggregate(
        makeMetricsAggregate({aggregate: nextAggregation, traceMetric})
      );
    },
    [updateFormAggregate, traceMetric]
  );

  return (
    <Flex direction="column" gap="md">
      <Flex gap="md" align="end">
        <Stack flex="1" gap="xs" maxWidth="425px">
          <div>
            <Tooltip
              title={t('Select the metric to monitor for this detector.')}
              showUnderline
            >
              <SectionLabel>{t('Metric')}</SectionLabel>
            </Tooltip>
          </div>
          <MetricsMetricSelector
            value={traceMetric}
            onChange={handleMetricChange}
            projectId={projectId}
            environment={environment}
          />
        </Stack>
        <Stack flex="1" gap="xs" maxWidth="425px">
          <div>
            <Tooltip
              title={t('The aggregation operation to apply to the metric.')}
              showUnderline
            >
              <SectionLabel>{t('Operation')}</SectionLabel>
            </Tooltip>
          </div>
          <MetricsAggregateDropdown
            value={aggregation}
            metricType={traceMetric.type}
            onChange={handleAggregationChange}
            disabled={!traceMetric.name}
          />
        </Stack>
      </Flex>
    </Flex>
  );
}
