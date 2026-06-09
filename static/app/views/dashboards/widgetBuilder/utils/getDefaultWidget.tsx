import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {type Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/typesBase';

export function getDefaultWidget(widgetType: WidgetType): Widget {
  const config = getDatasetConfig(widgetType);
  return {
    displayType: widgetType === WidgetType.ISSUE ? DisplayType.TABLE : DisplayType.LINE,
    interval: '',
    title: 'Custom Widget',
    widgetType,
    queries: [config.defaultWidgetQuery],
    axisRange: config.axisRange,
  };
}
