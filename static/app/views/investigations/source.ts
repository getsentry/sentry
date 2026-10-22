import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

type SourceCondition = {
  comparison: number;
  result: number;
  type: DataConditionType;
};

type DetectionType = 'static' | 'percent' | 'dynamic';

export type SourceMonitor = {
  aggregate: string | null;
  comparisonDeltaSeconds: number | null;
  conditions: SourceCondition[];
  detectionType: DetectionType | null;
  environment: string | null;
  name: string | null;
  projectSlug: string | null;
  query: string | null;
};

const DATA_CONDITION_TYPES = new Set<string>(Object.values(DataConditionType));
const DETECTION_TYPES = new Set<string>(['static', 'percent', 'dynamic']);

function getRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const field: unknown = (value as Record<string, unknown>)[key];
  return field && typeof field === 'object' ? (field as Record<string, unknown>) : null;
}

function getString(value: Record<string, unknown> | null, key: string): string | null {
  const field = value?.[key];
  return typeof field === 'string' && field ? field : null;
}

function getNumber(value: Record<string, unknown> | null, key: string): number | null {
  const field = value?.[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : null;
}

function isDataConditionType(value: string | null): value is DataConditionType {
  return value !== null && DATA_CONDITION_TYPES.has(value);
}

function isDetectionType(value: string | null): value is DetectionType {
  return value !== null && DETECTION_TYPES.has(value);
}

function getConditions(monitor: Record<string, unknown> | null): SourceCondition[] {
  const conditions = monitor?.conditions;
  if (!Array.isArray(conditions)) {
    return [];
  }
  return conditions.flatMap((condition: unknown) => {
    if (!condition || typeof condition !== 'object') {
      return [];
    }
    const record = condition as Record<string, unknown>;
    const comparison = getNumber(record, 'comparison');
    const result = getNumber(record, 'result');
    const type = getString(record, 'type');
    return comparison === null || result === null || !isDataConditionType(type)
      ? []
      : [{comparison, result, type}];
  });
}

// A breached metric investigation references the metric issue it was started
// from, and snapshots that issue's monitor. Older investigations may predate the
// snapshot, but still carry the issue reference.
export function getInvestigationSource(investigation: InvestigationDetail) {
  const {source} = investigation;
  return {
    groupId: getString(getRecord(source, 'ref'), 'groupId'),
    monitorName: getString(getRecord(getRecord(source, 'snapshot'), 'monitor'), 'name'),
  };
}

export function getSourceMonitor(
  source: InvestigationDetail['source'],
  detectorId: string
): SourceMonitor | null {
  const snapshot = getRecord(source, 'snapshot');
  const monitor = getRecord(snapshot, 'monitor');
  if (getString(monitor, 'id') !== detectorId) {
    return null;
  }
  const detectionType = getString(monitor, 'detectionType');
  return {
    name: getString(monitor, 'name'),
    aggregate: getString(monitor, 'aggregate'),
    query: getString(monitor, 'query'),
    environment: getString(monitor, 'environment'),
    detectionType: isDetectionType(detectionType) ? detectionType : null,
    comparisonDeltaSeconds: getNumber(monitor, 'comparisonDeltaSeconds'),
    conditions: getConditions(monitor),
    projectSlug: getString(getRecord(snapshot, 'project'), 'slug'),
  };
}
