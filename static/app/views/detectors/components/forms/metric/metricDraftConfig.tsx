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
  type DetectorDraftConfig,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {DEFAULT_THRESHOLD_METRIC_FORM_DATA} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormFields';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

export const METRIC_DETECTOR_DRAFT_CONFIG: DetectorDraftConfig<MetricDetectorFormData> = {
  shape: {
    aggregateFunction: z.string(),
    conditionComparisonAgo: z.number().optional(),
    conditionType: z.enum([DataConditionType.GREATER, DataConditionType.LESS]).optional(),
    dataset: z.enum(DetectorDataset),
    detectionType: z.enum(['static', 'percent', 'dynamic']),
    environment: z.string(),
    extrapolationMode: z.enum(ExtrapolationMode).optional(),
    highThreshold: draftNumericString.optional(),
    initialPriorityLevel: z.union([
      z.literal(DetectorPriorityLevel.MEDIUM),
      z.literal(DetectorPriorityLevel.HIGH),
    ]),
    interval: z.number(),
    mediumThreshold: draftNumericString.optional(),
    name: z.string(),
    owner: z.string(),
    projectId: z.string(),
    query: z.string(),
    resolutionStrategy: z.enum(['default', 'custom']).optional(),
    resolutionValue: draftNumericString.optional(),
    sensitivity: z.enum(AlertRuleSensitivity),
    thresholdType: z.enum(AlertRuleThresholdType),
    workflowIds: z.array(z.string()),
  },
  normalize: values => {
    const normalized =
      values.dataset === undefined
        ? omit(values, ['aggregateFunction', 'extrapolationMode', 'query'])
        : values;

    const dataset = normalized.dataset ?? DEFAULT_THRESHOLD_METRIC_FORM_DATA.dataset;
    const {supportedDetectionTypes} = getDatasetConfig(dataset);
    return normalized.detectionType === undefined ||
      supportedDetectionTypes.includes(normalized.detectionType)
      ? normalized
      : omit(normalized, ['detectionType']);
  },
};
