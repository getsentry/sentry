import {t} from 'sentry/locale';
import {SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';
import type {MetricAlertType} from 'sentry/views/alerts/wizard/options';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

interface TemplateOption {
  aggregate: string;
  detectorDataset: DetectorDataset;
  key: MetricAlertType;
  label: string;
  query?: string;
}

/**
 * Template options for metric detectors.
 * These define the available metric templates that users can select.
 */
export const METRIC_TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    key: 'num_errors',
    label: t('Number of Errors'),
    detectorDataset: DetectorDataset.ERRORS,
    aggregate: 'count()',
    query: 'is:unresolved',
  },
  {
    key: 'users_experiencing_errors',
    label: t('Users Experiencing Errors'),
    detectorDataset: DetectorDataset.ERRORS,
    aggregate: 'count_unique(user)',
    query: 'is:unresolved',
  },
  {
    key: 'trace_item_throughput',
    label: t('Throughput'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'count(span.duration)',
  },
  {
    key: 'trace_item_duration',
    label: t('Duration'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'p95(span.duration)',
  },
  {
    key: 'trace_item_failure_rate',
    label: t('Failure Rate'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'failure_rate()',
  },
  {
    key: 'trace_item_lcp',
    label: t('Largest Contentful Paint'),
    detectorDataset: DetectorDataset.SPANS,
    aggregate: 'p95(measurements.lcp)',
  },
  {
    key: 'trace_item_logs',
    label: t('Logs'),
    detectorDataset: DetectorDataset.LOGS,
    aggregate: 'count(message)',
  },
  {
    key: 'crash_free_sessions',
    label: t('Crash Free Session Rate'),
    detectorDataset: DetectorDataset.RELEASES,
    aggregate: SessionsAggregate.CRASH_FREE_SESSIONS,
  },
  {
    key: 'crash_free_users',
    label: t('Crash Free User Rate'),
    detectorDataset: DetectorDataset.RELEASES,
    aggregate: SessionsAggregate.CRASH_FREE_USERS,
  },
];
