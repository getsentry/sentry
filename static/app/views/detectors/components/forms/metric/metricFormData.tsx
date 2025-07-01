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
import type {
  Detector,
  DetectorConfig,
  MetricDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
} from 'sentry/views/alerts/rules/metric/types';

/**
 * Dataset types for detectors
 */
export const enum DetectorDataset {
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  SPANS = 'spans',
  RELEASES = 'releases',
}

/**
 * Snuba query types that correspond to the backend SnubaQuery.Type enum.
 * These values are defined in src/sentry/snuba/models.py:
 */
const enum SnubaQueryType {
  ERROR = 0,
  PERFORMANCE = 1,
  CRASH_RATE = 2,
}

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
  aggregateFunction: string;
  dataset: DetectorDataset;
  environment: string;
  interval: number;
  query: string;
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
  dataset: 'dataset',
  aggregateFunction: 'aggregateFunction',
  interval: 'interval',
  query: 'query',
  name: 'name',

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

  dataset: DetectorDataset.SPANS,
  aggregateFunction: 'avg(span.duration)',
  interval: 60 * 60, // One hour in seconds
  query: '',
} satisfies Partial<MetricDetectorFormData>;

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

export interface NewMetricDetectorPayload {
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
 * Convert backend dataset to our form dataset
 */
const getDetectorDataset = (backendDataset: string): DetectorDataset => {
  switch (backendDataset) {
    case Dataset.ERRORS:
      return DetectorDataset.ERRORS;
    case Dataset.TRANSACTIONS:
    case Dataset.GENERIC_METRICS:
      return DetectorDataset.TRANSACTIONS;
    case Dataset.EVENTS_ANALYTICS_PLATFORM:
      return DetectorDataset.SPANS;
    case Dataset.METRICS:
      return DetectorDataset.RELEASES; // Maps metrics dataset to releases for crash rate
    default:
      return DetectorDataset.ERRORS;
  }
};

/**
 * Convert our form dataset to the backend dataset
 */
const getBackendDataset = (dataset: DetectorDataset): string => {
  switch (dataset) {
    case DetectorDataset.ERRORS:
      return Dataset.ERRORS;
    case DetectorDataset.TRANSACTIONS:
      return Dataset.GENERIC_METRICS;
    case DetectorDataset.SPANS:
      return Dataset.EVENTS_ANALYTICS_PLATFORM;
    case DetectorDataset.RELEASES:
      return Dataset.METRICS; // Maps to metrics dataset for crash rate queries
    default:
      return Dataset.ERRORS;
  }
};

/**
 * Creates the data source configuration for the detector
 */
function createDataSource(data: MetricDetectorFormData): NewDataSource {
  const getEventTypes = (dataset: DetectorDataset): string[] => {
    switch (dataset) {
      case DetectorDataset.ERRORS:
        return ['error'];
      case DetectorDataset.TRANSACTIONS:
        return ['transaction'];
      case DetectorDataset.SPANS:
        return ['trace_item_span'];
      case DetectorDataset.RELEASES:
        return []; // Crash rate queries don't have event types
      default:
        return ['error'];
    }
  };

  /**
   * This maps to the backend query_datasets_to_type mapping.
   */
  const getQueryType = (dataset: DetectorDataset): number => {
    switch (dataset) {
      case DetectorDataset.ERRORS:
        return SnubaQueryType.ERROR;
      case DetectorDataset.TRANSACTIONS:
      case DetectorDataset.SPANS:
        return SnubaQueryType.PERFORMANCE;
      case DetectorDataset.RELEASES:
        return SnubaQueryType.CRASH_RATE; // Maps to crash rate for metrics dataset
      default:
        return SnubaQueryType.ERROR;
    }
  };

  return {
    queryType: getQueryType(data.dataset),
    dataset: getBackendDataset(data.dataset),
    query: data.query,
    aggregate: data.aggregateFunction,
    timeWindow: data.interval,
    environment: data.environment ? data.environment : null,
    eventTypes: getEventTypes(data.dataset),
  };
}

export function metricDetectorFormDataToEndpointPayload(
  data: MetricDetectorFormData
): MetricDetectorUpdatePayload {
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
export function metricSavedDetectorToFormData(
  detector: Detector
): MetricDetectorFormData {
  // Get the first data source (assuming metric detectors have one)
  const dataSource = detector.dataSources?.[0];

  // Check if this is a snuba query data source
  const snubaQuery =
    dataSource?.type === 'snuba_query_subscription'
      ? dataSource.queryObj?.snubaQuery
      : undefined;

  // Use the full aggregate string directly
  const aggregateFunction = snubaQuery?.aggregate || 'count()';

  // Process conditions using the extracted function
  const conditionData = processDetectorConditions(detector);

  const dataset = snubaQuery?.dataset
    ? getDetectorDataset(snubaQuery.dataset)
    : DetectorDataset.SPANS;

  const metricDetectorConfig =
    'detection_type' in detector.config
      ? detector.config
      : {
          detection_type: 'static' as const,
          threshold_period: 1,
        };

  return {
    // Core detector fields
    name: detector.name,
    projectId: detector.projectId,
    environment: snubaQuery?.environment || '',
    owner: detector.owner || '',
    query: snubaQuery?.query || '',
    aggregateFunction,
    dataset,
    interval: 60 * 60, // Default to 1 hour

    // Priority level and condition fields from processed conditions
    ...conditionData,
    kind: metricDetectorConfig.detection_type,

    // Condition fields - get comparison delta from detector config (already in seconds)
    conditionComparisonAgo:
      (metricDetectorConfig.detection_type === 'percent'
        ? metricDetectorConfig.comparison_delta
        : null) || 3600,

    // Dynamic fields - extract from config for dynamic detectors
    sensitivity:
      metricDetectorConfig.detection_type === 'dynamic'
        ? metricDetectorConfig.sensitivity || AlertRuleSensitivity.LOW
        : AlertRuleSensitivity.LOW,
    thresholdType:
      metricDetectorConfig.detection_type === 'dynamic'
        ? metricDetectorConfig.threshold_type || AlertRuleThresholdType.ABOVE
        : AlertRuleThresholdType.ABOVE,
  };
}
