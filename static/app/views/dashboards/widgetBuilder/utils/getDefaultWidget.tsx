import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, type Widget, type WidgetType} from 'sentry/views/dashboards/types';

export function getDefaultWidget(widgetType: WidgetType): Widget {
  const config = getDatasetConfig(widgetType);
  return {
    displayType: DisplayType.TABLE,
    interval: '',
    title: 'Custom Widget',
    widgetType,
    queries: [config.defaultWidgetQuery],
  };
}
