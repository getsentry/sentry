import {FunctionComponent, ReactNode} from 'react';
import {Location} from 'history';

import {Client} from 'app/api';
import BaseChart from 'app/components/charts/baseChart';
import {RenderProps} from 'app/components/charts/eventsRequest';
import {DateString, Organization, OrganizationSummary} from 'app/types';
import EventView from 'app/utils/discover/eventView';

import {PerformanceWidgetContainerTypes} from './components/performanceWidgetContainer';

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

export interface WidgetDataResult {
  isLoading: boolean;
  isErrored: boolean;
  hasData: boolean;
}
export interface WidgetDataConstraint {
  [dataKey: string]: WidgetDataResult | undefined;
}

export type QueryChildren = {
  children: (props: any) => ReactNode; // TODO(k-fish): Fix any type.
};
export type QueryFC<T extends WidgetDataConstraint> = FunctionComponent<
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
  enabled?: (data: T) => boolean;
  transform: (
    props: GenericPerformanceWidgetProps<T>,
    results: any,
    queryDefinition: QueryDefinitionWithKey<T>
  ) => S; // TODO(k-fish): Fix any type.
};
export type Queries<T extends WidgetDataConstraint> = Record<
  string,
  QueryDefinition<T, T[string]>
>;

type Visualization<T> = {
  component: FunctionComponent<{
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

type HeaderActions<T> = FunctionComponent<{
  widgetData: T;
}>;

type Subtitle<T> = FunctionComponent<{
  widgetData: T;
}>;

export type GenericPerformanceWidgetProps<T extends WidgetDataConstraint> = {
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
  EmptyComponent?: FunctionComponent<{height?: number}>;

  Queries: Queries<T>;
  Visualizations: Visualizations<T>;
};

export type GenericPerformanceWithData<T extends WidgetDataConstraint> =
  GenericPerformanceWidgetProps<T> & WidgetDataProps<T>;

export type WidgetDataProps<T> = {
  widgetData: T;
  setWidgetDataForKey: (dataKey: string, result?: WidgetDataResult) => void;
};

export type EventsRequestChildrenProps = RenderProps;

export type QueryDefinitionWithKey<T extends WidgetDataConstraint> = QueryDefinition<
  T,
  T[string]
> & {queryKey: string};

export type QueryHandlerProps<T extends WidgetDataConstraint> = {
  api: Client;
  queries: QueryDefinitionWithKey<T>[];
  children?: ReactNode;
  queryProps: WidgetPropUnion<T>;
} & WidgetDataProps<T>;

export type WidgetPropUnion<T extends WidgetDataConstraint> =
  GenericPerformanceWidgetProps<T>;
