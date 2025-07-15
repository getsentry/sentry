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
  MetricDetector,
  MetricDetectorConfig,
  MetricDetectorUpdatePayload,
} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {unreachable} from 'sentry/utils/unreachable';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
} from 'sentry/views/alerts/rules/metric/types';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

/**
 * Dataset types for detectors
 */
export const enum DetectorDataset {
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  SPANS = 'spans',
  RELEASES = 'releases',
  LOGS = 'logs',
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
  workflowIds: string[];
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
  workflowIds: 'workflowIds',

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

/**
 * Creates escalation conditions based on priority level and available thresholds
 */
export function createConditions(
  data: Pick<
    MetricDetectorFormData,
    'conditionType' | 'conditionValue' | 'initialPriorityLevel' | 'highThreshold'
  >
): NewConditionGroup['conditions'] {
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
export const getDetectorDataset = (
  backendDataset: Dataset,
  eventTypes: EventTypes[]
): DetectorDataset => {
  switch (backendDataset) {
    case Dataset.REPLAYS:
      throw new Error('Unsupported dataset');
    case Dataset.ERRORS:
    case Dataset.ISSUE_PLATFORM:
      return DetectorDataset.ERRORS;
    case Dataset.TRANSACTIONS:
    case Dataset.GENERIC_METRICS:
      return DetectorDataset.TRANSACTIONS;
    case Dataset.EVENTS_ANALYTICS_PLATFORM:
      // Spans and logs use the same dataset
      if (eventTypes.includes(EventTypes.TRACE_ITEM_SPAN)) {
        return DetectorDataset.SPANS;
      }
      if (eventTypes.includes(EventTypes.TRACE_ITEM_LOG)) {
        return DetectorDataset.LOGS;
      }
      if (eventTypes.includes(EventTypes.TRANSACTION)) {
        return DetectorDataset.TRANSACTIONS;
      }
      throw new Error(`Unsupported event types`);
    case Dataset.METRICS:
    case Dataset.SESSIONS:
      return DetectorDataset.RELEASES; // Maps metrics dataset to releases for crash rate
    default:
      unreachable(backendDataset);
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
      return Dataset.EVENTS_ANALYTICS_PLATFORM;
    case DetectorDataset.SPANS:
      return Dataset.EVENTS_ANALYTICS_PLATFORM;
    case DetectorDataset.RELEASES:
      return Dataset.METRICS;
    case DetectorDataset.LOGS:
      return Dataset.EVENTS_ANALYTICS_PLATFORM;
    default:
      unreachable(dataset);
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
      case DetectorDataset.LOGS:
        return ['trace_item_log'];
      default:
        unreachable(dataset);
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
      case DetectorDataset.LOGS:
        return SnubaQueryType.PERFORMANCE;
      case DetectorDataset.RELEASES:
        return SnubaQueryType.CRASH_RATE; // Maps to crash rate for metrics dataset
      default:
        unreachable(dataset);
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
  let config: MetricDetectorConfig;
  switch (data.kind) {
    case 'percent':
      config = {
        thresholdPeriod: 1,
        detectionType: 'percent',
        comparisonDelta: data.conditionComparisonAgo || 3600,
      };
      break;
    case 'dynamic':
      config = {
        thresholdPeriod: 1,
        detectionType: 'dynamic',
        sensitivity: data.sensitivity,
      };
      break;
    case 'static':
    default:
      config = {
        thresholdPeriod: 1,
        detectionType: 'static',
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
    workflowIds: data.workflowIds,
  };
}

/**
 * Convert the detector conditions array to the flattened form data
 */
function processDetectorConditions(
  detector: MetricDetector
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
  if (detector.type !== 'metric_issue') {
    // This should never happen
    throw new Error('Detector type mismatch');
  }

  const dataSource = detector.dataSources?.[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;

  // Use the full aggregate string directly
  const aggregateFunction = snubaQuery?.aggregate || 'count()';

  const conditionData = processDetectorConditions(detector);

  const dataset = snubaQuery?.dataset
    ? getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes)
    : DetectorDataset.SPANS;

  return {
    // Core detector fields
    name: detector.name,
    projectId: detector.projectId,
    workflowIds: detector.workflowIds,
    environment: getDetectorEnvironment(detector) || '',
    owner: detector.owner || '',
    query: snubaQuery?.query || '',
    aggregateFunction,
    dataset,
    interval: snubaQuery?.timeWindow ?? DEFAULT_THRESHOLD_METRIC_FORM_DATA.interval,

    // Priority level and condition fields from processed conditions
    ...conditionData,
    kind: detector.config.detectionType,

    // Condition fields - get comparison delta from detector config (already in seconds)
    conditionComparisonAgo:
      (detector.config.detectionType === 'percent'
        ? detector.config.comparisonDelta
        : null) || 3600,

    // Dynamic fields - extract from config for dynamic detectors
    sensitivity:
      detector.config.detectionType === 'dynamic'
        ? detector.config.sensitivity || AlertRuleSensitivity.LOW
        : AlertRuleSensitivity.LOW,
    thresholdType:
      detector.config.detectionType === 'dynamic'
        ? detector.config.thresholdType || AlertRuleThresholdType.ABOVE
        : AlertRuleThresholdType.ABOVE,
  };
}
