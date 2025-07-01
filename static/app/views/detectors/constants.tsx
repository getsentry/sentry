import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {FieldValueType} from 'sentry/utils/fields';

export const DETECTOR_LIST_PAGE_LIMIT = 20;

export const DETECTOR_FILTER_KEYS: Record<
  string,
  {
    description: string;
    keywords: string[];
    valueType: FieldValueType;
    values?: string[];
  }
> = {
  name: {
    description: 'Name of the detector (exact match)',
    valueType: FieldValueType.STRING,
    keywords: ['title'],
  },
  type: {
    description: 'Type of the detector (error, metric_issue, etc)',
    valueType: FieldValueType.STRING,
    values: [
      'error',
      'metric_issue',
      'uptime_subscription',
      'uptime_domain_failure',
    ] satisfies DetectorType[],
    keywords: ['type'],
  },
};
