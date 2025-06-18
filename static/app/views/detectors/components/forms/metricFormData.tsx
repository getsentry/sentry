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
import type {Detector, DetectorConfig} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
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

interface SnubaQueryFormData {
  aggregate: string;
  environment: string;
  query: string;
  visualize: string;
}

export interface MetricDetectorFormData
  extends PrioritizeLevelFormData,
    MetricDetectorConditionFormData,
    MetricDetectorDynamicFormData,
    SnubaQueryFormData {
  kind: 'static' | 'percent' | 'dynamic';
  name: string;
  owner: string;
  projectId: string;
}

type MetricDetectorFormFieldName = keyof MetricDetectorFormData;

/**
 * Enables type-safe form field names.
 * Helps you find areas setting specific fields.
 */
export const METRIC_DETECTOR_FORM_FIELDS = {
  // Core detector fields
  kind: 'kind',
  environment: 'environment',
  projectId: 'projectId',
  owner: 'owner',

  // Snuba query fields
  aggregate: 'aggregate',
  query: 'query',
  name: 'name',
  visualize: 'visualize',

  // Priority level fields
  initialPriorityLevel: 'initialPriorityLevel',
  highThreshold: 'highThreshold',
  mediumThreshold: 'mediumThreshold',

  // Condition fields
  conditionComparisonAgo: 'conditionComparisonAgo',
  conditionType: 'conditionType',
  conditionValue: 'conditionValue',

  // Dynamic fields
  sensitivity: 'sensitivity',
  thresholdType: 'thresholdType',
} satisfies Record<MetricDetectorFormFieldName, MetricDetectorFormFieldName>;

export const DEFAULT_THRESHOLD_METRIC_FORM_DATA = {
  kind: 'static',

  // Priority level fields
  // Metric detectors only support MEDIUM and HIGH priority levels
  initialPriorityLevel: DetectorPriorityLevel.HIGH,
  conditionType: DataConditionType.GREATER,
  conditionValue: '',
  conditionComparisonAgo: 60 * 60, // One hour in seconds

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
  owner: '',
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
  config: DetectorConfig;
  dataSource: NewDataSource; // Single data source object (not array)
  name: string;
  owner: Detector['owner'];
  projectId: Detector['projectId'];
  type: Detector['type'];
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
    defined(data.highThreshold) &&
    data.highThreshold !== ''
  ) {
    conditions.push({
      type: data.conditionType,
      comparison: parseFloat(data.highThreshold) || 0,
      conditionResult: DetectorPriorityLevel.HIGH,
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
    // TODO: Add interval to the form
    timeWindow: 60 * 60,
    environment: data.environment ? data.environment : null,
    eventTypes,
  };
}

export function getNewMetricDetectorData(
  data: MetricDetectorFormData
): NewMetricDetector {
  const conditions = createConditions(data);
  const dataSource = createDataSource(data);

  // Create config based on detection type
  let config: DetectorConfig;
  switch (data.kind) {
    case 'percent':
      config = {
        threshold_period: 1,
        detection_type: 'percent',
        comparison_delta: data.conditionComparisonAgo || 3600,
      };
      break;
    case 'dynamic':
      config = {
        threshold_period: 1,
        detection_type: 'dynamic',
        sensitivity: data.sensitivity,
      };
      break;
    case 'static':
    default:
      config = {
        threshold_period: 1,
        detection_type: 'static',
      };
      break;
  }

  return {
    name: data.name || 'New Monitor',
    type: 'metric_issue',
    projectId: data.projectId,
    owner: data.owner || null,
    conditionGroup: {
      // TODO: Can this be different values?
      logicType: DataConditionGroupLogicType.ANY,
      conditions,
    },
    config,
    dataSource,
  };
}

/**
 * Convert the detector conditions array to the flattened form data
 */
function processDetectorConditions(
  detector: Detector
): PrioritizeLevelFormData &
  Pick<MetricDetectorFormData, 'conditionValue' | 'conditionType'> {
  // Get conditions from the condition group
  const conditions = detector.conditionGroup?.conditions || [];
  // Sort by priority level, lowest first
  const sortedConditions = conditions.toSorted((a, b) => {
    return (a.conditionResult || 0) - (b.conditionResult || 0);
  });

  // Find the condition with the lowest non-zero priority level
  const mainCondition = sortedConditions.find(
    condition => condition.conditionResult !== DetectorPriorityLevel.OK
  );

  // Find high priority escalation condition
  const highCondition = conditions.find(
    condition => condition.conditionResult === DetectorPriorityLevel.HIGH
  );

  // Determine initial priority level, ensuring it's valid for the form
  let initialPriorityLevel: DetectorPriorityLevel.MEDIUM | DetectorPriorityLevel.HIGH =
    DetectorPriorityLevel.MEDIUM;

  if (mainCondition?.conditionResult === DetectorPriorityLevel.HIGH) {
    initialPriorityLevel = DetectorPriorityLevel.HIGH;
  } else if (mainCondition?.conditionResult === DetectorPriorityLevel.MEDIUM) {
    initialPriorityLevel = DetectorPriorityLevel.MEDIUM;
  }

  // Ensure condition type is valid for the form
  let conditionType: DataConditionType.GREATER | DataConditionType.LESS =
    DataConditionType.GREATER;
  if (
    mainCondition?.type === DataConditionType.LESS ||
    mainCondition?.type === DataConditionType.GREATER
  ) {
    conditionType = mainCondition.type;
  }

  return {
    initialPriorityLevel,
    conditionValue: mainCondition?.comparison.toString() || '',
    conditionType,
    highThreshold: highCondition?.comparison.toString() || '',
  };
}

/**
 * Converts a Detector to MetricDetectorFormData for editing
 */
export function getMetricDetectorFormData(detector: Detector): MetricDetectorFormData {
  // Get the first data source (assuming metric detectors have one)
  const dataSource = detector.dataSources?.[0];

  // Check if this is a snuba query data source
  const snubaQuery =
    dataSource?.type === 'snuba_query_subscription'
      ? dataSource.queryObj?.snubaQuery
      : undefined;

  // Extract aggregate and visualize from the aggregate string
  const parsedFunction = snubaQuery?.aggregate
    ? parseFunction(snubaQuery.aggregate)
    : null;
  const aggregate = parsedFunction?.name || 'count';
  const visualize = parsedFunction?.arguments[0] || 'transaction.duration';

  // Process conditions using the extracted function
  const conditionData = processDetectorConditions(detector);

  return {
    // Core detector fields
    name: detector.name,
    projectId: detector.projectId,
    environment: snubaQuery?.environment || '',
    owner: detector.owner || '',
    query: snubaQuery?.query || '',
    aggregate,
    visualize,

    // Priority level and condition fields from processed conditions
    ...conditionData,
    kind: detector.config.detection_type || 'static',

    // Condition fields - get comparison delta from detector config (already in seconds)
    conditionComparisonAgo:
      (detector.config?.detection_type === 'percent'
        ? detector.config.comparison_delta
        : null) || 3600,

    // Dynamic fields - extract from config for dynamic detectors
    sensitivity:
      detector.config?.detection_type === 'dynamic'
        ? detector.config.sensitivity || AlertRuleSensitivity.LOW
        : AlertRuleSensitivity.LOW,
    thresholdType:
      detector.config?.detection_type === 'dynamic'
        ? (detector.config as any).threshold_type || AlertRuleThresholdType.ABOVE
        : AlertRuleThresholdType.ABOVE,
  };
}
