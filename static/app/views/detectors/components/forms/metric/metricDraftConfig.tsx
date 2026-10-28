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
  draftNumericString,
  type DetectorDraftSchema,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormFields';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

export const METRIC_DETECTOR_DRAFT_SCHEMA: DetectorDraftSchema<MetricDetectorFormData> = z
  .object({
    aggregateFunction: z.string().optional().catch(undefined),
    conditionComparisonAgo: z.number().optional().catch(undefined),
    conditionType: z
      .enum([DataConditionType.GREATER, DataConditionType.LESS])
      .optional()
      .catch(undefined),
    dataset: z.enum(DetectorDataset).optional().catch(undefined),
    detectionType: z.enum(['static', 'percent', 'dynamic']).optional().catch(undefined),
    environment: z.string().optional().catch(undefined),
    extrapolationMode: z.enum(ExtrapolationMode).optional().catch(undefined),
    highThreshold: draftNumericString.optional().catch(undefined),
    initialPriorityLevel: z
      .literal([DetectorPriorityLevel.MEDIUM, DetectorPriorityLevel.HIGH])
      .optional()
      .catch(undefined),
    interval: z.number().optional().catch(undefined),
    mediumThreshold: draftNumericString.optional().catch(undefined),
    name: z.string().optional().catch(undefined),
    owner: z.string().optional().catch(undefined),
    projectId: z.string().optional().catch(undefined),
    query: z.string().optional().catch(undefined),
    resolutionStrategy: z.enum(['default', 'custom']).optional().catch(undefined),
    resolutionValue: draftNumericString.optional().catch(undefined),
    sensitivity: z.enum(AlertRuleSensitivity).optional().catch(undefined),
    thresholdType: z.enum(AlertRuleThresholdType).optional().catch(undefined),
    workflowIds: z.array(z.string()).optional().catch(undefined),
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
