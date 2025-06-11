import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {PriorityLevel} from 'sentry/types/group';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';

interface PrioritizeLevelFormData {
  /**
   * Issue is created at this priority level
   */
  initialPriorityLevel: PriorityLevel;
  /**
   * High priority value is optional depending on the initial level
   */
  highThreshold?: string;
  /**
   * Medium priority value is optional depending on the initial level
   */
  mediumThreshold?: string;
  /**
   * Optional value at which the issue is resolved
   */
  resolveThreshold?: number;
}

interface MetricDetectorConditionFormData {
  /**
   * Used when kind=change for the previous value comparison
   */
  conditionComparisonAgo?: number;
  /**
   * Both kind=threshold and kind=change
   */
  conditionType?: 'gt' | 'lte';
  /**
   * When this value is exceeded the issue is created at initialPriorityLevel
   * Both kind=threshold and kind=change
   */
  conditionValue?: string;
}

interface MetricDetectorDynamicFormData {
  sensitivity: AlertRuleSensitivity;
  thresholdType: AlertRuleThresholdType;
}

export interface MetricDetectorFormData
  extends PrioritizeLevelFormData,
    MetricDetectorConditionFormData,
    MetricDetectorDynamicFormData {
  aggregate: string;
  environment: string;
  kind: 'threshold' | 'change' | 'dynamic';
  name: string;
  projectId: string;
  query: string;
  visualize: string;
}

type MetricDetectorFormFieldName = keyof MetricDetectorFormData;

/**
 * Enables type-safe form field names.
 * Helps you find areas setting specific fields.
 */
export const METRIC_DETECTOR_FORM_FIELDS = {
  // Core detector fields
  aggregate: 'aggregate',
  query: 'query',
  kind: 'kind',
  name: 'name',
  visualize: 'visualize',
  environment: 'environment',
  projectId: 'projectId',

  // Priority level fields
  initialPriorityLevel: 'initialPriorityLevel',
  highThreshold: 'highThreshold',
  mediumThreshold: 'mediumThreshold',
  resolveThreshold: 'resolveThreshold',

  // Condition fields
  conditionComparisonAgo: 'conditionComparisonAgo',
  conditionType: 'conditionType',
  conditionValue: 'conditionValue',

  // Dynamic fields
  sensitivity: 'sensitivity',
  thresholdType: 'thresholdType',
} satisfies Record<MetricDetectorFormFieldName, MetricDetectorFormFieldName>;

export const DEFAULT_THRESHOLD_METRIC_FORM_DATA = {
  kind: 'threshold',

  // Priority level fields
  initialPriorityLevel: PriorityLevel.LOW,
  conditionType: 'gt',
  conditionValue: '',
  conditionComparisonAgo: 60 * 60, // One hour in seconds

  // Default dynamic fields
  sensitivity: AlertRuleSensitivity.LOW,
  thresholdType: AlertRuleThresholdType.ABOVE,

  // Snuba query fields
  visualize: 'span.duration',
  aggregate: 'p75',
  query: '',

  // Passed in from step 1
  environment: '',
  projectId: '',
  name: '',
} satisfies MetricDetectorFormData;

/**
 * Small helper to automatically get the type of the form field.
 */
export function useMetricDetectorFormField<T extends MetricDetectorFormFieldName>(
  name: T
): MetricDetectorFormData[T] {
  const value = useFormField(name);
  return value;
}
