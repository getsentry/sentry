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
import {bytesToMB, mbToBytes} from 'sentry/views/settings/project/preprod/types';

interface PreprodDetectorFormData {
  description: string | null;
  highThreshold: string;
  lowThreshold: string;
  measurement: PreprodMeasurement;
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
  lowThreshold: 'lowThreshold',
} satisfies Record<PreprodDetectorFormFieldName, PreprodDetectorFormFieldName>;

export const PREPROD_DEFAULT_FORM_DATA: Partial<PreprodDetectorFormData> = {
  measurement: 'install_size',
  thresholdType: 'absolute',
  highThreshold: '',
  lowThreshold: '',
};

export function usePreprodDetectorFormField<T extends PreprodDetectorFormFieldName>(
  name: T
): PreprodDetectorFormData[T] | undefined {
  return useFormField(name);
}

function createPreprodConditions(
  data: PreprodDetectorFormData
): PreprodDetectorUpdatePayload['conditionGroup']['conditions'] {
  const conditions: PreprodDetectorUpdatePayload['conditionGroup']['conditions'] = [];
  const isPercentage = data.thresholdType === 'relative_diff';
  const conditionType = DataConditionType.GREATER;

  if (data.highThreshold) {
    conditions.push({
      type: conditionType,
      comparison: isPercentage
        ? parseFloat(data.highThreshold)
        : mbToBytes(parseFloat(data.highThreshold)),
      conditionResult: DetectorPriorityLevel.HIGH,
    });
  }
  if (data.lowThreshold) {
    conditions.push({
      type: conditionType,
      comparison: isPercentage
        ? parseFloat(data.lowThreshold)
        : mbToBytes(parseFloat(data.lowThreshold)),
      conditionResult: DetectorPriorityLevel.LOW,
    });
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

function conditionToThreshold(
  comparison: number | unknown,
  isPercentage: boolean
): string {
  if (typeof comparison !== 'number') {
    return '';
  }
  return String(isPercentage ? comparison : bytesToMB(comparison));
}

export function preprodSavedDetectorToFormData(
  detector: PreprodDetector
): PreprodDetectorFormData {
  const conditions = detector.conditionGroup?.conditions || [];
  const isPercentage = detector.config.thresholdType === 'relative_diff';

  const highCondition = conditions.find(
    c => c.conditionResult === DetectorPriorityLevel.HIGH
  );
  const lowCondition = conditions.find(
    c => c.conditionResult === DetectorPriorityLevel.LOW
  );

  return {
    name: detector.name,
    projectId: detector.projectId,
    owner: detector.owner ? `${detector.owner.type}:${detector.owner.id}` : '',
    description: detector.description || null,
    workflowIds: detector.workflowIds,
    measurement: detector.config.measurement,
    thresholdType: detector.config.thresholdType,
    highThreshold: conditionToThreshold(highCondition?.comparison, isPercentage),
    lowThreshold: conditionToThreshold(lowCondition?.comparison, isPercentage),
  };
}
