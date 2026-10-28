import omit from 'lodash/omit';
import {z} from 'zod';

import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import {
  draftField,
  draftNumericString,
  type DetectorDraftSchema,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormFields';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

export const METRIC_DETECTOR_DRAFT_SCHEMA: DetectorDraftSchema<MetricDetectorFormData> = z
  .object({
    aggregateFunction: draftField(z.string()),
    conditionComparisonAgo: draftField(z.number()),
    conditionType: draftField(
      z.enum([DataConditionType.GREATER, DataConditionType.LESS])
    ),
    dataset: draftField(z.enum(DetectorDataset)),
    detectionType: draftField(z.enum(['static', 'percent', 'dynamic'])),
    environment: draftField(z.string()),
    extrapolationMode: draftField(z.enum(ExtrapolationMode)),
    highThreshold: draftField(draftNumericString),
    initialPriorityLevel: draftField(
      z.literal([DetectorPriorityLevel.MEDIUM, DetectorPriorityLevel.HIGH])
    ),
    interval: draftField(z.number()),
    mediumThreshold: draftField(draftNumericString),
    name: draftField(z.string()),
    owner: draftField(z.string()),
    projectId: draftField(z.string()),
    query: draftField(z.string()),
    resolutionStrategy: draftField(z.enum(['default', 'custom'])),
    resolutionValue: draftField(draftNumericString),
    sensitivity: draftField(z.enum(AlertRuleSensitivity)),
    thresholdType: draftField(z.enum(AlertRuleThresholdType)),
    workflowIds: draftField(z.array(z.string())),
  })
  .transform(values => {
    if (values.dataset === undefined) {
      return omit(values, [
        'aggregateFunction',
        'detectionType',
        'extrapolationMode',
        'query',
      ]);
    }
    return values.detectionType === undefined ||
      getDatasetConfig(values.dataset).supportedDetectionTypes.includes(
        values.detectionType
      )
      ? values
      : omit(values, ['detectionType']);
  });
