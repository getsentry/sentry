import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  PreprodDetector,
  PreprodDetectorUpdatePayload,
  PreprodMeasurement,
  PreprodThresholdType,
} from 'sentry/types/workflowEngine/detectors';

interface PreprodDetectorFormData {
  description: string | null;
  highThreshold: string;
  lowThreshold: string;
  measurement: PreprodMeasurement;
  mediumThreshold: string;
  name: string;
  owner: string;
  projectId: string;
  thresholdType: PreprodThresholdType;
  workflowIds: string[];
}

type PreprodDetectorFormFieldName = keyof PreprodDetectorFormData;

export const PREPROD_DETECTOR_FORM_FIELDS = {
  name: 'name',
  projectId: 'projectId',
  owner: 'owner',
  description: 'description',
  workflowIds: 'workflowIds',
  measurement: 'measurement',
  thresholdType: 'thresholdType',
  highThreshold: 'highThreshold',
  mediumThreshold: 'mediumThreshold',
  lowThreshold: 'lowThreshold',
} satisfies Record<PreprodDetectorFormFieldName, PreprodDetectorFormFieldName>;

export const PREPROD_DEFAULT_FORM_DATA: Partial<PreprodDetectorFormData> = {
  measurement: 'install_size',
  thresholdType: 'absolute_threshold',
  highThreshold: '',
  mediumThreshold: '',
  lowThreshold: '',
};

export function usePreprodDetectorFormField<T extends PreprodDetectorFormFieldName>(
  name: T
): PreprodDetectorFormData[T] {
  return useFormField(name) as PreprodDetectorFormData[T];
}

function mbToBytes(mb: string): number {
  const value = parseFloat(mb);
  if (Number.isNaN(value)) {
    return 0;
  }
  return value * 1024 * 1024;
}

function bytesToMb(bytes: string): number {
  const value = parseFloat(bytes);
  if (Number.isNaN(value)) {
    return 0;
  }
  return value / (1024 * 1024);
}

function createPreprodConditions(
  data: PreprodDetectorFormData
): PreprodDetectorUpdatePayload['conditionGroup']['conditions'] {
  const conditions: PreprodDetectorUpdatePayload['conditionGroup']['conditions'] = [];
  const isPercentage = data.thresholdType === 'relative_diff';
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
    type: 'preprod_size_analysis',
    projectId: data.projectId,
    owner: data.owner || null,
    description: data.description || null,
    workflowIds: data.workflowIds || [],
    conditionGroup: {
      logicType: DataConditionGroupLogicType.ANY,
      conditions,
    },
    config: {
      measurement: data.measurement,
      thresholdType: data.thresholdType,
    },
  };
}

export function preprodSavedDetectorToFormData(
  detector: PreprodDetector
): PreprodDetectorFormData {
  const conditions = detector.conditionGroup?.conditions || [];

  const highCondition = conditions.find(
    c => c.conditionResult === DetectorPriorityLevel.HIGH
  );
  const mediumCondition = conditions.find(
    c => c.conditionResult === DetectorPriorityLevel.MEDIUM
  );
  const lowCondition = conditions.find(
    c => c.conditionResult === DetectorPriorityLevel.LOW
  );

  const highThreshold = String(
    bytesToMb(
      String(
        typeof highCondition?.comparison === 'number' ? highCondition.comparison : ''
      )
    )
  );
  const mediumThreshold = String(
    bytesToMb(
      String(
        typeof mediumCondition?.comparison === 'number' ? mediumCondition.comparison : ''
      )
    )
  );
  const lowThreshold = String(
    bytesToMb(
      String(typeof lowCondition?.comparison === 'number' ? lowCondition.comparison : '')
    )
  );

  return {
    name: detector.name,
    projectId: detector.projectId,
    owner: detector.owner ? `${detector.owner.type}:${detector.owner.id}` : '',
    description: detector.description || null,
    workflowIds: detector.workflowIds,
    measurement: detector.config.measurement,
    thresholdType: detector.config.thresholdType,
    highThreshold,
    mediumThreshold,
    lowThreshold,
  };
}
