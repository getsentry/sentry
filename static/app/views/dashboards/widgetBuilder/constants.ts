import {DisplayType, type Widget} from 'sentry/views/dashboards/types';

export const MAX_NUM_Y_AXES = 3;

export const WIDGET_BUILDER_SESSION_STORAGE_KEY_MAP: Record<
  keyof WidgetBuilderStateLocalParams,
  {key: string; storeCondition: (widget: Widget) => boolean; widgetField: keyof Widget}
> = {
  textContent: {
    key: 'dashboard:widget-builder:text-content',
    widgetField: 'description',
    storeCondition: (widget: Widget) => widget.displayType === DisplayType.TEXT,
  },
};

export type WidgetBuilderStateLocalParams = {
  textContent?: string;
};

export const BuilderStateAction = {
  SET_TITLE: 'SET_TITLE',
  SET_DESCRIPTION: 'SET_DESCRIPTION',
  SET_DISPLAY_TYPE: 'SET_DISPLAY_TYPE',
  SET_DATASET: 'SET_DATASET',
  SET_FIELDS: 'SET_FIELDS',
  SET_Y_AXIS: 'SET_Y_AXIS',
  SET_TRANSFORMATIONS: 'SET_TRANSFORMATIONS',
  SET_AGGREGATE_TRANSFORMATIONS: 'SET_AGGREGATE_TRANSFORMATIONS',
  SET_QUERY: 'SET_QUERY',
  SET_SORT: 'SET_SORT',
  SET_LINKED_DASHBOARDS: 'SET_LINKED_DASHBOARDS',
  SET_LIMIT: 'SET_LIMIT',
  SET_LEGEND_ALIAS: 'SET_LEGEND_ALIAS',
  SET_LEGEND_TYPE: 'SET_LEGEND_TYPE',
  SET_SELECTED_AGGREGATE: 'SET_SELECTED_AGGREGATE',
  SET_STATE: 'SET_STATE',
  SET_TEXT_CONTENT: 'SET_TEXT_CONTENT',
  SET_THRESHOLDS: 'SET_THRESHOLDS',
  // Categorical bar chart specific actions
  SET_CATEGORICAL_X_AXIS: 'SET_CATEGORICAL_X_AXIS',
  SET_CATEGORICAL_AGGREGATE: 'SET_CATEGORICAL_AGGREGATE',
  DELETE_AGGREGATE: 'DELETE_AGGREGATE',
  SET_AXIS_RANGE: 'SET_AXIS_RANGE',
} as const;

export const CUSTOM_EQUATION_VALUE = 'custom-equation';
