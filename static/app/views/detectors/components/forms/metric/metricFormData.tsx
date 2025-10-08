import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  Detector,
  MetricCondition,
  MetricConditionGroup,
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
} from 'sentry/views/alerts/rules/metric/types';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {getDetectorEnvironment} from 'sentry/views/detectors/utils/getDetectorEnvironment';

/**
 * Snuba query types that correspond to the backend SnubaQuery.Type enum.
 * These values are defined in src/sentry/snuba/models.py:
 */
export const enum SnubaQueryType {
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
  /**
   * Strategy for how an issue should be resolved
   * - automatic: resolves based on the primary condition value
   * - manual: resolves based on a custom resolution value
   */
  resolutionStrategy?: 'automatic' | 'manual';
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
}

export interface MetricDetectorFormData
  extends PrioritizeLevelFormData,
    MetricDetectorConditionFormData,
    MetricDetectorDynamicFormData,
    SnubaQueryFormData {
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
  resolutionStrategy: 'resolutionStrategy',
  resolutionValue: 'resolutionValue',

  // Dynamic fields
  sensitivity: 'sensitivity',
  thresholdType: 'thresholdType',
} satisfies Record<MetricDetectorFormFieldName, MetricDetectorFormFieldName>;

export const DEFAULT_THRESHOLD_METRIC_FORM_DATA = {
  detectionType: 'static',

  // Priority level fields
  // Metric detectors only support MEDIUM and HIGH priority levels
  initialPriorityLevel: DetectorPriorityLevel.HIGH,
  conditionType: DataConditionType.GREATER,
  conditionValue: '',
  resolutionStrategy: 'automatic',
  resolutionValue: '',
  conditionComparisonAgo: 60 * 60, // One hour in seconds

  // Default dynamic fields
  sensitivity: AlertRuleSensitivity.MEDIUM,
  thresholdType: AlertRuleThresholdType.ABOVE_AND_BELOW,

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
  conditions: Array<Omit<MetricCondition, 'id'>>;
  logicType: MetricConditionGroup['logicType'];
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
    | 'conditionType'
    | 'conditionValue'
    | 'initialPriorityLevel'
    | 'highThreshold'
    | 'resolutionStrategy'
    | 'resolutionValue'
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

  // Optionally add explicit resolution (OK) condition when manual strategy is chosen
  if (
    data.resolutionStrategy === 'manual' &&
    defined(data.resolutionValue) &&
    data.resolutionValue !== ''
  ) {
    const resolutionConditionType =
      data.conditionType === DataConditionType.GREATER
        ? DataConditionType.LESS
        : DataConditionType.GREATER;

    conditions.push({
      type: resolutionConditionType,
      comparison: parseFloat(data.resolutionValue) || 0,
      conditionResult: DetectorPriorityLevel.OK,
    });
  }

  return conditions;
}

/**
 * Convert our form dataset to the backend dataset
 */
export const getBackendDataset = (dataset: DetectorDataset): Dataset => {
  switch (dataset) {
    case DetectorDataset.ERRORS:
      return Dataset.ERRORS;
    case DetectorDataset.TRANSACTIONS:
      return Dataset.GENERIC_METRICS;
    case DetectorDataset.RELEASES:
      return Dataset.METRICS;
    case DetectorDataset.SPANS:
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

  const datasetConfig = getDatasetConfig(data.dataset);
  const {eventTypes, query} = datasetConfig.separateEventTypesFromQuery(data.query);

  return {
    queryType: getQueryType(data.dataset),
    dataset: getBackendDataset(data.dataset),
    query,
    aggregate: datasetConfig.toApiAggregate(data.aggregateFunction),
    timeWindow: data.interval,
    environment: data.environment ? data.environment : null,
    eventTypes,
  };
}

export function metricDetectorFormDataToEndpointPayload(
  data: MetricDetectorFormData
): MetricDetectorUpdatePayload {
  const conditions = createConditions(data);
  const dataSource = createDataSource(data);

  // Create config based on detection type
  let config: MetricDetectorConfig;
  switch (data.detectionType) {
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
  Pick<
    MetricDetectorFormData,
    'conditionValue' | 'conditionType' | 'resolutionStrategy' | 'resolutionValue'
  > {
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

  // Find explicit resolution (OK) condition, if present
  const okCondition = conditions.find(
    condition => condition.conditionResult === DetectorPriorityLevel.OK
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

  // Determine resolution strategy: automatic if OK threshold matches warning or critical
  const resolutionValue = okCondition?.comparison ?? undefined;
  const computedResolutionStrategy: 'automatic' | 'manual' =
    defined(resolutionValue) &&
    ![mainCondition?.comparison, highCondition?.comparison].includes(resolutionValue)
      ? 'manual'
      : 'automatic';

  return {
    initialPriorityLevel,
    conditionValue:
      typeof mainCondition?.comparison === 'number'
        ? mainCondition.comparison.toString()
        : '',
    conditionType,
    highThreshold:
      typeof highCondition?.comparison === 'number'
        ? highCondition.comparison.toString()
        : '',
    resolutionStrategy: computedResolutionStrategy,
    resolutionValue:
      typeof okCondition?.comparison === 'number'
        ? okCondition.comparison.toString()
        : '',
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

  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;

  const conditionData = processDetectorConditions(detector);

  const dataset = snubaQuery?.dataset
    ? getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes)
    : DetectorDataset.SPANS;

  const datasetConfig = getDatasetConfig(dataset);

  return {
    // Core detector fields
    name: detector.name,
    projectId: detector.projectId,
    workflowIds: detector.workflowIds,
    environment: getDetectorEnvironment(detector) || '',
    owner: detector.owner ? `${detector.owner?.type}:${detector.owner?.id}` : '',
    query: datasetConfig.toSnubaQueryString(snubaQuery),
    aggregateFunction:
      datasetConfig.fromApiAggregate(snubaQuery?.aggregate || '') ||
      DEFAULT_THRESHOLD_METRIC_FORM_DATA.aggregateFunction,
    dataset,
    interval: snubaQuery?.timeWindow ?? DEFAULT_THRESHOLD_METRIC_FORM_DATA.interval,

    // Priority level and condition fields from processed conditions
    ...conditionData,
    detectionType: detector.config.detectionType,

    // Condition fields - get comparison delta from detector config (already in seconds)
    conditionComparisonAgo:
      detector.config.detectionType === 'percent' &&
      defined(detector.config.comparisonDelta)
        ? detector.config.comparisonDelta
        : DEFAULT_THRESHOLD_METRIC_FORM_DATA.conditionComparisonAgo,

    // Dynamic fields - extract from config for dynamic detectors
    sensitivity:
      detector.config.detectionType === 'dynamic' && defined(detector.config.sensitivity)
        ? detector.config.sensitivity
        : DEFAULT_THRESHOLD_METRIC_FORM_DATA.sensitivity,
    thresholdType:
      detector.config.detectionType === 'dynamic' &&
      defined(detector.config.thresholdType)
        ? detector.config.thresholdType
        : DEFAULT_THRESHOLD_METRIC_FORM_DATA.thresholdType,
  };
}
