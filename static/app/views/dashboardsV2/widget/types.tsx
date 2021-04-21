import {Project} from 'app/types';

export enum DisplayType {
  AREA = 'area',
  BAR = 'bar',
  LINE = 'line',
  TABLE = 'table',
  WORLD_MAP = 'world_map',
  BIG_NUMBER = 'big_number',
  STACKED_AREA = 'stacked_area',
}

export enum WidgetType {
  EVENT = 'event',
  METRIC = 'metric',
}

export enum DataSet {
  EVENTS = 'events',
  METRICS = 'metrics',
}

type QueryBase = {
  name: string;
  fields: string[];
  conditions: string;
};

export type EventWidgetQuery = {
  orderby: string;
} & QueryBase;

export type MetricWidgetQuery = {
  groupBy: string;
  projectId: Project['id'];
} & QueryBase;

type WidgetBase = {
  title: string;
  displayType: DisplayType;
  id?: string;
};

export type MetricWidget = {
  type: WidgetType;
  metrics_queries: MetricWidgetQuery[];
} & WidgetBase;

export type EventWidget = {
  type: WidgetType.EVENT;
  interval: string;
  queries: EventWidgetQuery[];
} & WidgetBase;

export type Widget = EventWidget | MetricWidget;
