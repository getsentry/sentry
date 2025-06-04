import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, type Widget, WidgetType} from 'sentry/views/dashboards/types';

export function getDefaultWidget(widgetType: WidgetType): Widget {
  const config = getDatasetConfig(widgetType);
  return {
    displayType: widgetType === WidgetType.ISSUE ? DisplayType.TABLE : DisplayType.LINE,
    interval: '',
    title: 'Custom Widget',
    widgetType,
    queries: [config.defaultWidgetQuery],
  };
}
