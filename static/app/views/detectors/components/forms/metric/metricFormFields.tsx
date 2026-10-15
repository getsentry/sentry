import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';
import type {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import type {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

/**
 * Form field types, names, and accessor hook for the metric detector form.
 *
 * This module must stay free of dataset config imports (e.g. getDatasetConfig)
 * so it can be used by dataset config components without creating cycles.
 */

export interface PrioritizeLevelFormData {
  /**
   * Issue is created at this priority level
   */
  initialPriorityLevel: DetectorPriorityLevel.MEDIUM | DetectorPriorityLevel.HIGH;
  /**
   * High priority value is optional depending on the initial level
   */
  highThreshold?: string;
  /**
   * Medium priority value is optional depending on the initial level
   */
  mediumThreshold?: string;
}

interface MetricDetectorConditionFormData {
  /**
   * Used when kind=change for the previous value comparison
   */
  conditionComparisonAgo?: number;
  /**
   * Both kind=threshold and kind=change
   */
  conditionType?: DataConditionType.GREATER | DataConditionType.LESS;
  /**
   * High priority threshold value
   * Both kind=threshold and kind=change
   */
  highThreshold?: string;
  /**
   * Strategy for how an issue should be resolved
   * - default: resolves based on the primary condition value
   * - custom: resolves based on a custom resolution value
   */
  resolutionStrategy?: 'default' | 'custom';
  resolutionValue?: string;
}

interface MetricDetectorDynamicFormData {
  sensitivity: AlertRuleSensitivity;
  thresholdType: AlertRuleThresholdType;
}

interface SnubaQueryFormData {
  aggregateFunction: string;
  dataset: DetectorDataset;
  environment: string;
  interval: number;
  query: string;
  extrapolationMode?: ExtrapolationMode;
}

export interface MetricDetectorFormData
  extends
    PrioritizeLevelFormData,
    MetricDetectorConditionFormData,
    MetricDetectorDynamicFormData,
    SnubaQueryFormData {
  description: string | null;
  detectionType: MetricDetectorConfig['detectionType'];
  name: string;
  owner: string;
  projectId: string;
  workflowIds: string[];
}

type MetricDetectorFormFieldName = keyof MetricDetectorFormData;

/**
 * Enables type-safe form field names.
 * Helps you find areas setting specific fields.
 */
export const METRIC_DETECTOR_FORM_FIELDS = {
  // Core detector fields
  detectionType: 'detectionType',
  environment: 'environment',
  projectId: 'projectId',
  owner: 'owner',
  workflowIds: 'workflowIds',
  description: 'description',

  // Snuba query fields
  dataset: 'dataset',
  aggregateFunction: 'aggregateFunction',
  interval: 'interval',
  query: 'query',
  name: 'name',
  extrapolationMode: 'extrapolationMode',

  // Priority level fields
  initialPriorityLevel: 'initialPriorityLevel',
  highThreshold: 'highThreshold',
  mediumThreshold: 'mediumThreshold',

  // Condition fields
  conditionComparisonAgo: 'conditionComparisonAgo',
  conditionType: 'conditionType',
  resolutionStrategy: 'resolutionStrategy',
  resolutionValue: 'resolutionValue',

  // Dynamic fields
  sensitivity: 'sensitivity',
  thresholdType: 'thresholdType',
} satisfies Record<MetricDetectorFormFieldName, MetricDetectorFormFieldName>;

/**
 * Small helper to automatically get the type of the form field.
 */
export function useMetricDetectorFormField<T extends MetricDetectorFormFieldName>(
  name: T
): MetricDetectorFormData[T] {
  const value = useFormField(name);
  return value;
}
