import type FormModel from 'sentry/components/forms/model';
import {getFormFieldValue} from 'sentry/components/workflowEngine/form/getFormFieldValue';
import {t} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import getDuration from 'sentry/utils/duration/getDuration';
import {unreachable} from 'sentry/utils/unreachable';
import {useSetAutomaticName} from 'sentry/views/detectors/components/forms/common/useSetAutomaticName';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  type MetricDetectorFormData,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getStaticDetectorThresholdSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

/**
 * Automatically generates a name for the metric detector form based on the values:
 * - Dataset
 * - Aggregate function
 * - Detection type
 * - Direction (above or below)
 * - Threshold value
 * - Interval
 *
 * e.g. "p95(span.duration) above 100ms compared to past 1 hour"
 */
export function useAutoMetricDetectorName() {
  useSetAutomaticName((form: FormModel): string | null => {
    const detectionType = getFormFieldValue<MetricDetectorFormData['detectionType']>(
      form,
      METRIC_DETECTOR_FORM_FIELDS.detectionType
    );
    const aggregate = getFormFieldValue<MetricDetectorFormData['aggregateFunction']>(
      form,
      METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
    );
    const interval = getFormFieldValue<MetricDetectorFormData['interval']>(
      form,
      METRIC_DETECTOR_FORM_FIELDS.interval
    );
    const dataset = getFormFieldValue<MetricDetectorFormData['dataset']>(
      form,
      METRIC_DETECTOR_FORM_FIELDS.dataset
    );
    const datasetConfig = getDatasetConfig(dataset);

    if (!aggregate || !interval || !detectionType || !dataset) {
      return null;
    }

    switch (detectionType) {
      case 'static': {
        const conditionType = getFormFieldValue<MetricDetectorFormData['conditionType']>(
          form,
          METRIC_DETECTOR_FORM_FIELDS.conditionType
        );
        const conditionValue = getFormFieldValue<
          MetricDetectorFormData['conditionValue']
        >(form, METRIC_DETECTOR_FORM_FIELDS.conditionValue);

        if (!conditionType || !conditionValue) {
          return null;
        }

        const suffix = getStaticDetectorThresholdSuffix(aggregate);
        const direction =
          conditionType === DataConditionType.GREATER ? t('above') : t('below');

        return t(
          '%(aggregate)s %(aboveOrBelow)s %(value)s%(unit)s over past %(interval)s',
          {
            aggregate: datasetConfig.formatAggregateForTitle?.(aggregate) ?? aggregate,
            aboveOrBelow: direction,
            value: conditionValue,
            unit: suffix,
            interval: getDuration(interval),
          }
        );
      }
      case 'percent': {
        const conditionType = getFormFieldValue<MetricDetectorFormData['conditionType']>(
          form,
          METRIC_DETECTOR_FORM_FIELDS.conditionType
        );
        const conditionValue = getFormFieldValue<
          MetricDetectorFormData['conditionValue']
        >(form, METRIC_DETECTOR_FORM_FIELDS.conditionValue);

        if (!conditionType || !conditionValue) {
          return null;
        }

        const direction =
          conditionType === DataConditionType.GREATER ? t('higher') : t('lower');

        return t(
          '%(aggregate)s %(aboveOrBelow)s by %(value)s%% compared to past %(interval)s',
          {
            aggregate: datasetConfig.formatAggregateForTitle?.(aggregate) ?? aggregate,
            aboveOrBelow: direction,
            value: conditionValue,
            interval: getDuration(interval),
          }
        );
      }
      case 'dynamic':
        return t('%(aggregate)s is anomalous', {
          aggregate: datasetConfig.formatAggregateForTitle?.(aggregate) ?? aggregate,
        });
      default:
        unreachable(detectionType);
        return null;
    }
  });
}
