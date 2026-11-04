import {t} from 'sentry/locale';
import {WidgetType} from 'sentry/views/dashboards/types';

export const DATASET_CHOICES = new Map<WidgetType, string>([
  [WidgetType.ERRORS, t('Errors')],
  [WidgetType.SPANS, t('Spans')],
  [WidgetType.LOGS, t('Logs')],
  [WidgetType.TRACEMETRICS, t('Application Metrics')],
  [WidgetType.RELEASE, t('Releases')],
  [WidgetType.ISSUE, t('Issues')],
]);

export function getDatasetLabel(dataset: WidgetType) {
  return DATASET_CHOICES.get(dataset) ?? '';
}
