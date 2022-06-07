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
  ContainerActions: React.FC<{isLoading: boolean}>;
  chartDefinition: ChartDefinition;
  chartHeight: number;

  chartSetting: PerformanceWidgetSetting;
  eventView: EventView;
  fields: string[];
  location: Location;

  organization: Organization;
  title: string;
  titleTooltip: string;

  chartColor?: string;

  noCellActions?: boolean;
};

export interface WidgetDataResult {
  hasData: boolean;
  isErrored: boolean;
  isLoading: boolean;
}
export interface WidgetDataConstraint {
  [dataKey: string]: WidgetDataResult | undefined;
}

export type QueryChildren = {
  children: (props: any) => React.ReactNode; // TODO(k-fish): Fix any type.
};
export type QueryFC<T extends WidgetDataConstraint> = React.FC<
  QueryChildren & {
    eventView: EventView;
    orgSlug: string;
    organization: OrganizationSummary;
    widgetData: T;
    end?: DateString;
    environment?: Readonly<string[]>;
    fields?: string | string[];
    period?: string | null;
    project?: Readonly<number[]>;
    query?: string;
    referrer?: string;
    start?: DateString;
    team?: Readonly<string | string[]>;
    yAxis?: string | string[];
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
    grid?: React.ComponentProps<typeof BaseChart>['grid'];
    height?: number;
    queryFields?: string;
  }>;
  height: number;
  bottomPadding?: boolean;
  dataState?: (data: T) => VisualizationDataState;
  fields?: string;
  noPadding?: boolean;
  queryFields?: string[]; // Used to determine placeholder and loading sizes. Will also be passed to the component.
};

type Visualizations<T extends WidgetDataConstraint> = Readonly<Visualization<T>[]>; // Readonly because of index being used for React key.

type HeaderActions<T> = React.FC<{
  widgetData: T;
}>;

type Subtitle<T> = React.FC<{
  widgetData: T;
}>;

export type GenericPerformanceWidgetProps<T extends WidgetDataConstraint> = {
  Queries: Queries<T>;
  Visualizations: Visualizations<T>;

  chartDefinition: ChartDefinition;
  chartHeight: number;

  chartSetting: PerformanceWidgetSetting;
  containerType: PerformanceWidgetContainerTypes;
  eventView: EventView;

  fields: string[];
  location: Location;
  organization: Organization;

  // Header;
  title: string;
  titleTooltip: string;
  EmptyComponent?: React.FC<{height?: number}>;

  HeaderActions?: HeaderActions<T>;
  // Components
  Subtitle?: Subtitle<T>;
};

export type GenericPerformanceWithData<T extends WidgetDataConstraint> =
  GenericPerformanceWidgetProps<T> & WidgetDataProps<T>;

export type WidgetDataProps<T> = {
  removeWidgetDataForKey: (dataKey: string) => void;
  setWidgetDataForKey: (dataKey: string, result?: WidgetDataResult) => void;
  widgetData: T;
};

export type EventsRequestChildrenProps = RenderProps;

export type QueryDefinitionWithKey<T extends WidgetDataConstraint> = QueryDefinition<
  T,
  T[string]
> & {queryKey: string};

export type QueryHandlerProps<T extends WidgetDataConstraint> = {
  api: Client;
  eventView: EventView;
  queries: QueryDefinitionWithKey<T>[];
  queryProps: WidgetPropUnion<T>;
  children?: React.ReactNode;
} & WidgetDataProps<T>;

export type WidgetPropUnion<T extends WidgetDataConstraint> =
  GenericPerformanceWidgetProps<T>;
