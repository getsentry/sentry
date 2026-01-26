import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  PreprodDetector,
  PreprodDetectorUpdatePayload,
  PreprodFilter,
  PreprodMeasurement,
  PreprodMetric,
} from 'sentry/types/workflowEngine/detectors';

export interface PreprodDetectorFormData {
  // Core fields
  description: string | null;
  environment: string;
  filters: PreprodFilter[];
  highThreshold: string;
  lowThreshold: string;
  measurement: PreprodMeasurement;
  mediumThreshold: string;
  metric: PreprodMetric;
  name: string;
  owner: string;
  projectId: string;
  workflowIds: string[];
}

type PreprodDetectorFormFieldName = keyof PreprodDetectorFormData;

export const PREPROD_DETECTOR_FORM_FIELDS = {
  name: 'name',
  projectId: 'projectId',
  owner: 'owner',
  description: 'description',
  workflowIds: 'workflowIds',
  environment: 'environment',
  metric: 'metric',
  measurement: 'measurement',
  filters: 'filters',
  highThreshold: 'highThreshold',
  mediumThreshold: 'mediumThreshold',
  lowThreshold: 'lowThreshold',
} satisfies Record<PreprodDetectorFormFieldName, PreprodDetectorFormFieldName>;

export const PREPROD_DEFAULT_FORM_DATA: Partial<PreprodDetectorFormData> = {
  metric: 'install_size',
  measurement: 'absolute',
  filters: [],
  highThreshold: '',
  mediumThreshold: '',
  lowThreshold: '',
};

export function usePreprodDetectorFormField<T extends PreprodDetectorFormFieldName>(
  name: T
): PreprodDetectorFormData[T] {
  return useFormField(name) as PreprodDetectorFormData[T];
}

/**
 * Convert MB value to bytes
 */
function mbToBytes(mb: string): number {
  const value = parseFloat(mb);
  if (Number.isNaN(value)) {
    return 0;
  }
  return value * 1024 * 1024;
}

function createPreprodConditions(
  data: PreprodDetectorFormData
): PreprodDetectorUpdatePayload['conditionGroup']['conditions'] {
  const conditions: PreprodDetectorUpdatePayload['conditionGroup']['conditions'] = [];
  const isPercentage = data.measurement === 'relative_diff';
  const conditionType = DataConditionType.GREATER;

  if (isPercentage) {
    if (data.highThreshold) {
      conditions.push({
        type: conditionType,
        comparison: parseFloat(data.highThreshold),
        conditionResult: DetectorPriorityLevel.HIGH,
      });
    }
    if (data.mediumThreshold) {
      conditions.push({
        type: conditionType,
        comparison: parseFloat(data.mediumThreshold),
        conditionResult: DetectorPriorityLevel.MEDIUM,
      });
    }
    if (data.lowThreshold) {
      conditions.push({
        type: conditionType,
        comparison: parseFloat(data.lowThreshold),
        conditionResult: DetectorPriorityLevel.LOW,
      });
    }
  } else {
    if (data.highThreshold) {
      conditions.push({
        type: conditionType,
        comparison: mbToBytes(data.highThreshold),
        conditionResult: DetectorPriorityLevel.HIGH,
      });
    }
    if (data.mediumThreshold) {
      conditions.push({
        type: conditionType,
        comparison: mbToBytes(data.mediumThreshold),
        conditionResult: DetectorPriorityLevel.MEDIUM,
      });
    }
    if (data.lowThreshold) {
      conditions.push({
        type: conditionType,
        comparison: mbToBytes(data.lowThreshold),
        conditionResult: DetectorPriorityLevel.LOW,
      });
    }
  }

  return conditions;
}

export function preprodFormDataToEndpointPayload(
  data: PreprodDetectorFormData
): PreprodDetectorUpdatePayload {
  const conditions = createPreprodConditions(data);

  return {
    name: data.name || 'New Monitor',
    type: 'preprod_static',
    projectId: data.projectId,
    owner: data.owner || null,
    description: data.description || null,
    workflowIds: data.workflowIds || [],
    conditionGroup: {
      logicType: DataConditionGroupLogicType.ANY,
      conditions,
    },
    config: {
      metric: data.metric,
      measurement: data.measurement,
    },
    dataSources: [],
  };
}

export function preprodSavedDetectorToFormData(
  detector: PreprodDetector
): PreprodDetectorFormData {
  const dataSource = detector.dataSources?.[0];
  const conditions = detector.conditionGroup?.conditions || [];

  const highCondition = conditions.find(c => c.conditionResult === 'high');
  const mediumCondition = conditions.find(c => c.conditionResult === 'medium');
  const lowCondition = conditions.find(c => c.conditionResult === 'low');

  return {
    name: detector.name,
    projectId: detector.projectId,
    owner: detector.owner ? `${detector.owner.type}:${detector.owner.id}` : '',
    description: detector.description || null,
    workflowIds: detector.workflowIds,
    environment: detector.config.environment || '',
    metric: detector.config.metric,
    measurement: detector.config.measurement,
    filters: dataSource?.queryObj?.filters || [],
    highThreshold: String(highCondition?.comparison ?? ''),
    mediumThreshold: String(mediumCondition?.comparison ?? ''),
    lowThreshold: String(lowCondition?.comparison ?? ''),
  };
}
