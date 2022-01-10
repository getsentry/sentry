import {Location} from 'history';

import {Client} from 'sentry/api';
import BaseChart from 'sentry/components/charts/baseChart';
import {RenderProps} from 'sentry/components/charts/eventsRequest';
import {DateString, Organization, OrganizationSummary} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';

import {PerformanceWidgetContainerTypes} from './components/performanceWidgetContainer';
import {ChartDefinition, PerformanceWidgetSetting} from './widgetDefinitions';

export enum VisualizationDataState {
  ERROR = 'error',
  LOADING = 'loading',
  EMPTY = 'empty',
  DATA = 'data',
}

export enum GenericPerformanceWidgetDataType {
  histogram = 'histogram',
  area = 'area',
  vitals = 'vitals',
  line_list = 'line_list',
  trends = 'trends',
}

export type PerformanceWidgetProps = {
  chartSetting: PerformanceWidgetSetting;
  chartDefinition: ChartDefinition;
  chartHeight: number;

  title: string;
  titleTooltip: string;
  fields: string[];
  chartColor?: string;

  eventView: EventView;
  location: Location;
  organization: Organization;

  ContainerActions: React.FC<{isLoading: boolean}>;
};

export interface WidgetDataResult {
  isLoading: boolean;
  isErrored: boolean;
  hasData: boolean;
}
export interface WidgetDataConstraint {
  [dataKey: string]: WidgetDataResult | undefined;
}

export type QueryChildren = {
  children: (props: any) => React.ReactNode; // TODO(k-fish): Fix any type.
};
export type QueryFC<T extends WidgetDataConstraint> = React.FC<
  QueryChildren & {
    fields?: string | string[];
    yAxis?: string | string[];
    period?: string;
    start?: DateString;
    end?: DateString;
    project?: Readonly<number[]>;
    environment?: Readonly<string[]>;
    team?: Readonly<string | string[]>;
    query?: string;
    orgSlug: string;
    eventView: EventView;
    organization: OrganizationSummary;
    widgetData: T;
  }
>;

export type QueryDefinition<
  T extends WidgetDataConstraint,
  S extends WidgetDataResult | undefined
> = {
  component: QueryFC<T>;
  fields: string | string[];
  transform: (
    props: GenericPerformanceWidgetProps<T>,
    results: any,
    queryDefinition: QueryDefinitionWithKey<T>
  ) => S; // TODO(k-fish): Fix any type.
  enabled?: (data: T) => boolean;
};
export type Queries<T extends WidgetDataConstraint> = Record<
  string,
  QueryDefinition<T, T[string]>
>;

type Visualization<T> = {
  component: React.FC<{
    widgetData: T;
    queryFields?: string;
    grid?: React.ComponentProps<typeof BaseChart>['grid'];
    height?: number;
  }>;
  dataState?: (data: T) => VisualizationDataState;
  fields?: string;
  noPadding?: boolean;
  bottomPadding?: boolean;
  queryFields?: string[];
  height: number; // Used to determine placeholder and loading sizes. Will also be passed to the component.
};

type Visualizations<T extends WidgetDataConstraint> = Readonly<Visualization<T>[]>; // Readonly because of index being used for React key.

type HeaderActions<T> = React.FC<{
  widgetData: T;
}>;

type Subtitle<T> = React.FC<{
  widgetData: T;
}>;

export type GenericPerformanceWidgetProps<T extends WidgetDataConstraint> = {
  chartSetting: PerformanceWidgetSetting;
  chartDefinition: ChartDefinition;

  // Header;
  title: string;
  titleTooltip: string;

  fields: string[];
  chartHeight: number;
  containerType: PerformanceWidgetContainerTypes;

  location: Location;
  eventView: EventView;
  organization: Organization;

  // Components
  Subtitle?: Subtitle<T>;
  HeaderActions?: HeaderActions<T>;
  EmptyComponent?: React.FC<{height?: number}>;

  Queries: Queries<T>;
  Visualizations: Visualizations<T>;
};

export type GenericPerformanceWithData<T extends WidgetDataConstraint> =
  GenericPerformanceWidgetProps<T> & WidgetDataProps<T>;

export type WidgetDataProps<T> = {
  widgetData: T;
  setWidgetDataForKey: (dataKey: string, result?: WidgetDataResult) => void;
  removeWidgetDataForKey: (dataKey: string) => void;
};

export type EventsRequestChildrenProps = RenderProps;

export type QueryDefinitionWithKey<T extends WidgetDataConstraint> = QueryDefinition<
  T,
  T[string]
> & {queryKey: string};

export type QueryHandlerProps<T extends WidgetDataConstraint> = {
  api: Client;
  queries: QueryDefinitionWithKey<T>[];
  eventView: EventView;
  queryProps: WidgetPropUnion<T>;
  children?: React.ReactNode;
} & WidgetDataProps<T>;

export type WidgetPropUnion<T extends WidgetDataConstraint> =
  GenericPerformanceWidgetProps<T>;
