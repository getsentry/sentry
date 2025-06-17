import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';

interface PrioritizeLevelFormData {
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
  /**
   * Optional value at which the issue is resolved
   */
  resolveThreshold?: string;
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
  // Metric detectors only support MEDIUM and HIGH priority levels
  initialPriorityLevel: DetectorPriorityLevel.MEDIUM,
  conditionType: DataConditionType.GREATER,
  conditionValue: '',
  conditionComparisonAgo: 60 * 60, // One hour in seconds
  resolveThreshold: '',

  // Default dynamic fields
  sensitivity: AlertRuleSensitivity.LOW,
  thresholdType: AlertRuleThresholdType.ABOVE,

  // Snuba query fields
  visualize: 'transaction.duration',
  aggregate: 'count',
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

interface NewConditionGroup {
  conditions: Array<Omit<DataCondition, 'id'>>;
  logicType: DataConditionGroup['logicType'];
}

interface NewDataSource {
  aggregate: string;
  dataset: string;
  environment: string | null;
  eventTypes: string[];
  query: string;
  queryType: number;
  timeWindow: number;
}

export interface NewMetricDetector {
  conditionGroup: NewConditionGroup;
  // TODO: config types don't exist yet
  config: {
    // TODO: what is the shape of config?
    detection_type: any;
    threshold_period: number;
  };
  dataSource: NewDataSource; // Single data source object (not array)
  detectorType: Detector['type'];
  name: string;
  projectId: Detector['projectId'];
}

/**
 * Creates escalation conditions based on priority level and available thresholds
 */
function createConditions(data: MetricDetectorFormData): NewConditionGroup['conditions'] {
  if (!defined(data.conditionType) || !defined(data.conditionValue)) {
    return [];
  }

  const conditions: NewConditionGroup['conditions'] = [
    // Always create the main condition for the initial priority level
    {
      type: data.conditionType,
      comparison: parseFloat(data.conditionValue) || 0,
      conditionResult: data.initialPriorityLevel,
    },
  ];

  // Only add HIGH escalation if initial priority is MEDIUM and highThreshold is provided
  if (
    data.initialPriorityLevel === DetectorPriorityLevel.MEDIUM &&
    defined(data.highThreshold)
  ) {
    conditions.push({
      type: data.conditionType,
      comparison: parseFloat(data.highThreshold) || 0,
      conditionResult: DetectorPriorityLevel.HIGH,
    });
  }

  // Create resolution condition if provided
  if (defined(data.resolveThreshold)) {
    // Resolution condition uses opposite comparison type
    const resolveConditionType =
      data.conditionType === DataConditionType.GREATER
        ? DataConditionType.LESS
        : DataConditionType.GREATER;

    conditions.push({
      type: resolveConditionType,
      comparison: data.resolveThreshold,
      conditionResult: DetectorPriorityLevel.OK,
    });
  }

  return conditions;
}

/**
 * Creates the data source configuration for the detector
 */
function createDataSource(data: MetricDetectorFormData): NewDataSource {
  const dataset = 'events';
  const eventTypes = ['error'];

  return {
    // TODO: Add an enum for queryType and dataset or look for existing ones
    queryType: 0,
    dataset,
    query: data.query,
    // TODO: aggregate doesn't always contain the selected "visualize" value.
    aggregate: `${data.aggregate}(${data.visualize})`,
    timeWindow: data.conditionComparisonAgo ? data.conditionComparisonAgo / 60 : 60,
    environment: data.environment ? data.environment : null,
    eventTypes,
  };
}

export function getNewMetricDetectorData(
  data: MetricDetectorFormData
): NewMetricDetector {
  const conditions = createConditions(data);
  const dataSource = createDataSource(data);

  return {
    name: data.name || 'New Monitor',
    detectorType: 'metric_issue',
    projectId: data.projectId,
    conditionGroup: {
      // TODO: Can this be different values?
      logicType: DataConditionGroupLogicType.ANY,
      conditions,
    },
    config: {
      threshold_period: 1,
      detection_type: 'static',
    },
    dataSource,
  };
}
