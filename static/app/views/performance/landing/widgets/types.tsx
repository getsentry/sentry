import type {Location} from 'history';

import type {Client} from 'sentry/api';
import type BaseChart from 'sentry/components/charts/baseChart';
import type {RenderProps} from 'sentry/components/charts/eventsRequest';
import type {DateString} from 'sentry/types/core';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';

import type {PerformanceWidgetContainerTypes} from './components/performanceWidgetContainer';
import type {ChartDefinition, PerformanceWidgetSetting} from './widgetDefinitions';

export enum VisualizationDataState {
  ERROR = 'error',
  LOADING = 'loading',
  EMPTY = 'empty',
  DATA = 'data',
}

export enum GenericPerformanceWidgetDataType {
  HISTOGRAM = 'histogram',
  AREA = 'area',
  VITALS = 'vitals',
  LINE_LIST = 'line_list',
  TRENDS = 'trends',
  STACKED_AREA = 'stacked_area',
  PERFORMANCE_SCORE = 'performance_score',
  SLOW_SCREENS_BY_TTID = 'slow_screens_by_ttid',
  PERFORMANCE_SCORE_LIST = 'performance_score_list',
  SLOW_SCREENS_BY_COLD_START = 'slow_screens_by_cold_start',
  SLOW_SCREENS_BY_WARM_START = 'slow_screens_by_warm_start',
}

export type PerformanceWidgetProps = {
  ContainerActions: React.ComponentType<{isLoading: boolean}> | null;
  chartDefinition: ChartDefinition;
  chartHeight: number;

  chartSetting: PerformanceWidgetSetting;
  eventView: EventView;
  fields: string[];

  organization: Organization;
  title: string;
  titleTooltip: string;
  InteractiveTitle?: React.ComponentType<{isLoading: boolean}> | null;

  chartColor?: string;

  subTitle?: string;

  withStaticFilters?: boolean;
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
export type QueryFC<T extends WidgetDataConstraint> = React.ComponentType<
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
  S extends WidgetDataResult | undefined,
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
  component: React.ComponentType<{
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

type HeaderActions<T> = React.ComponentType<{
  widgetData: T;
}>;

type InteractiveTitle<T> = React.ComponentType<{widgetData: T}>;

type Subtitle<T> = React.ComponentType<{
  widgetData: T;
}>;

export type GenericPerformanceWidgetProps<T extends WidgetDataConstraint> = {
  Queries: Queries<T>;
  Visualizations: Visualizations<T>;

  chartDefinition: ChartDefinition;
  chartSetting: PerformanceWidgetSetting;
  eventView: EventView;

  fields: string[];
  location: Location;
  organization: Organization;

  // Header;
  title: string;
  titleTooltip: string;
  EmptyComponent?: React.ComponentType<{height?: number}>;
  HeaderActions?: HeaderActions<T>;

  InteractiveTitle?: InteractiveTitle<T> | null;
  Subtitle?: Subtitle<T>;
  /**
   * @default 200
   */
  chartHeight?: number;
  /**
   * @default 'panel'
   */
  containerType?: PerformanceWidgetContainerTypes;
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
