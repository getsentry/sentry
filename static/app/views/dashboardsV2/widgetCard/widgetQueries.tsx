import {Component} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import trimStart from 'lodash/trimStart';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {Client, ResponseMeta} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
  PageFilters,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import {isEquation, isEquationAlias} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';

import {getDatasetConfig} from '../datasetConfig/base';
import {
  DEFAULT_TABLE_LIMIT,
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from '../types';
import {getDashboardsMEPQueryParams, getNumEquations, getWidgetInterval} from '../utils';

import {DashboardsMEPContext} from './dashboardsMEPContext';

type RawResult = EventsStats | MultiSeriesEventsStats;

type SeriesWithOrdering = [order: number, series: Series];

export function transformSeries(stats: EventsStats, seriesName: string): Series {
  return {
    seriesName,
    data:
      stats?.data?.map(([timestamp, counts]) => ({
        name: timestamp * 1000,
        value: counts.reduce((acc, {count}) => acc + count, 0),
      })) ?? [],
  };
}

/**
 * Multiseries data with a grouping needs to be "flattened" because the aggregate data
 * are stored under the group names. These names need to be combined with the aggregate
 * names to show a series.
 *
 * e.g. count() and count_unique() grouped by environment
 * {
 *    "local": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    },
 *    "prod": {
 *      "count()": {...},
 *      "count_unique()": {...}
 *    }
 * }
 */
export function flattenMultiSeriesDataWithGrouping(
  result: RawResult,
  queryAlias: string
): SeriesWithOrdering[] {
  const seriesWithOrdering: SeriesWithOrdering[] = [];
  const groupNames = Object.keys(result);

  groupNames.forEach(groupName => {
    // Each group contains an order key which we should ignore
    const aggregateNames = Object.keys(omit(result[groupName], 'order'));

    aggregateNames.forEach(aggregate => {
      const seriesName = `${groupName} : ${aggregate}`;
      const prefixedName = queryAlias ? `${queryAlias} > ${seriesName}` : seriesName;
      const seriesData: EventsStats = result[groupName][aggregate];

      seriesWithOrdering.push([
        result[groupName].order || 0,
        transformSeries(seriesData, prefixedName),
      ]);
    });
  });

  return seriesWithOrdering;
}

function getIsMetricsDataFromSeriesResponse(result: RawResult): boolean | undefined {
  const multiIsMetricsData = Object.values(result)
    .map(({isMetricsData}) => isMetricsData)
    // One non-metrics series will cause all of them to be marked as such
    .reduce((acc, value) => (acc === false ? false : value), undefined);

  return isMultiSeriesStats(result) ? multiIsMetricsData : result.isMetricsData;
}

type Props = {
  api: Client;
  children: (
    props: Pick<
      State,
      'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage' | 'pageLinks'
    >
  ) => React.ReactNode;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  onDataFetched?: (results: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
  }) => void;
};

type State = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: null | string;
  queryFetchID?: symbol;
  rawResults?: RawResult[];
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
};

class WidgetQueries extends Component<Props, State> {
  state: State = {
    loading: true,
    queryFetchID: undefined,
    errorMessage: undefined,
    timeseriesResults: undefined,
    rawResults: undefined,
    tableResults: undefined,
    pageLinks: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, widget, cursor, organization} = this.props;

    // We do not fetch data whenever the query name changes.
    // Also don't count empty fields when checking for field changes
    const [prevWidgetQueryNames, prevWidgetQueries] = prevProps.widget.queries
      .map((query: WidgetQuery) => {
        query.aggregates = query.aggregates.filter(field => !!field);
        query.columns = query.columns.filter(field => !!field);
        return query;
      })
      .reduce(
        ([names, queries]: [string[], Omit<WidgetQuery, 'name'>[]], {name, ...rest}) => {
          names.push(name);
          queries.push(rest);
          return [names, queries];
        },
        [[], []]
      );

    const [widgetQueryNames, widgetQueries] = widget.queries
      .map((query: WidgetQuery) => {
        query.aggregates = query.aggregates.filter(
          field => !!field && field !== 'equation|'
        );
        query.columns = query.columns.filter(field => !!field && field !== 'equation|');
        return query;
      })
      .reduce(
        ([names, queries]: [string[], Omit<WidgetQuery, 'name'>[]], {name, ...rest}) => {
          names.push(name);
          queries.push(rest);
          return [names, queries];
        },
        [[], []]
      );

    if (
      widget.limit !== prevProps.widget.limit ||
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isEqual(widget.interval, prevProps.widget.interval) ||
      !isEqual(widgetQueries, prevWidgetQueries) ||
      !isSelectionEqual(selection, prevProps.selection) ||
      cursor !== prevProps.cursor
    ) {
      this.fetchData();
      return;
    }

    if (
      !this.state.loading &&
      !isEqual(prevWidgetQueryNames, widgetQueryNames) &&
      this.state.rawResults?.length === widget.queries.length
    ) {
      // If the query names has changed, then update timeseries labels

      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(prevState => {
        const timeseriesResults = widget.queries.reduce((acc: Series[], query, index) => {
          return acc.concat(
            this.config.transformSeries!(
              prevState.rawResults![index],
              query,
              organization
            )
          );
        }, []);

        return {...prevState, timeseriesResults};
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  static contextType = DashboardsMEPContext;
  context: React.ContextType<typeof DashboardsMEPContext> | undefined;
  config = getDatasetConfig(WidgetType.DISCOVER);

  private _isMounted: boolean = false;

  get isMEPEnabled() {
    // Events endpoint can return either always transactions, metrics, or metrics with a fallback to transactions (basically auto).
    // For now, we are always keeping it on "auto" (if you have feature flag enabled).
    // There's a chance that in the future this might become an explicit selector in the product.
    return this.props.organization.features.includes('dashboards-mep');
  }

  async fetchTableData(queryFetchID: symbol) {
    const {selection, api, organization, widget, limit, cursor, onDataFetched} =
      this.props;

    let tableResults: TableDataWithTitle[] = [];
    // Table, world map, and stat widgets use table results and need
    // to do a discover 'table' query instead of a 'timeseries' query.
    let referrer: string = '';
    let requestLimit: number | undefined;
    if (widget.displayType === DisplayType.TABLE) {
      requestLimit = limit ?? DEFAULT_TABLE_LIMIT;
      referrer = 'api.dashboards.tablewidget';
    } else if (widget.displayType === DisplayType.BIG_NUMBER) {
      requestLimit = 1;
      referrer = 'api.dashboards.bignumberwidget';
    } else if (widget.displayType === DisplayType.WORLD_MAP) {
      referrer = 'api.dashboards.worldmapwidget';
    } else {
      throw Error('Expected widget displayType to be either big_number or table');
    }

    let responses: [TableData | EventsTableData, string, ResponseMeta][] = [];
    try {
      responses = await Promise.all(
        widget.queries.map(query => {
          const requestGenerator =
            widget.displayType === DisplayType.WORLD_MAP
              ? this.config.getWorldMapRequest
              : this.config.getTableRequest;
          return requestGenerator!(
            api,
            query,
            {
              organization,
              pageFilters: selection,
            },
            requestLimit,
            cursor,
            referrer
          );
        })
      );
    } catch (err) {
      const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
      this.setState({errorMessage});
    } finally {
      if (!this._isMounted) {
        return;
      }
    }

    let isMetricsData: boolean | undefined;
    responses.forEach(([data, _textstatus, resp], i) => {
      // If one of the queries is sampled, then mark the whole thing as sampled
      isMetricsData = isMetricsData === false ? false : data.meta?.isMetricsData;

      // Cast so we can add the title.
      const tableData = this.config.transformTable(
        data,
        widget.queries[0],
        organization,
        selection
      ) as TableDataWithTitle;
      tableData.title = widget.queries[i]?.name ?? '';

      // Overwrite the local var to work around state being stale in tests.
      tableResults = [...tableResults, tableData];

      if (!this._isMounted) {
        return;
      }
      const pageLinks = resp?.getResponseHeader('Link');

      onDataFetched?.({tableResults, pageLinks: pageLinks ?? undefined});

      this.setState(prevState => {
        if (prevState.queryFetchID !== queryFetchID) {
          // invariant: a different request was initiated after this request
          return prevState;
        }

        return {
          ...prevState,
          tableResults,
          pageLinks,
        };
      });
    });

    this.context?.setIsMetricsData(isMetricsData);
    this.setState(prevState => {
      if (prevState.queryFetchID !== queryFetchID) {
        // invariant: a different request was initiated after this request
        return prevState;
      }

      return {
        ...prevState,
        loading: false,
      };
    });
  }

  fetchTimeseriesData(queryFetchID: symbol, displayType: DisplayType) {
    const {selection, api, organization, widget, onDataFetched} = this.props;
    this.setState({timeseriesResults: [], rawResults: []});

    const {environments, projects} = selection;
    const {start, end, period: statsPeriod} = selection.datetime;
    const interval = getWidgetInterval(
      widget.displayType,
      {
        start,
        end,
        period: statsPeriod,
      },
      widget.interval
    );
    const promises = widget.queries.map(query => {
      let requestData;
      if (widget.displayType === 'top_n') {
        requestData = {
          organization,
          interval,
          start,
          end,
          project: projects,
          environment: environments,
          period: statsPeriod,
          query: query.conditions,
          yAxis: query.aggregates[query.aggregates.length - 1],
          includePrevious: false,
          referrer: `api.dashboards.widget.${displayType}-chart`,
          partial: true,
          topEvents: TOP_N,
          field: [...query.columns, ...query.aggregates],
          queryExtras: getDashboardsMEPQueryParams(this.isMEPEnabled),
        };
        if (query.orderby) {
          requestData.orderby = query.orderby;
        }
      } else {
        requestData = {
          organization,
          interval,
          start,
          end,
          project: projects,
          environment: environments,
          period: statsPeriod,
          query: query.conditions,
          yAxis: query.aggregates,
          orderby: query.orderby,
          includePrevious: false,
          referrer: `api.dashboards.widget.${displayType}-chart`,
          partial: true,
          queryExtras: getDashboardsMEPQueryParams(this.isMEPEnabled),
        };

        if (
          organization.features.includes('new-widget-builder-experience-design') &&
          [DisplayType.AREA, DisplayType.BAR, DisplayType.LINE].includes(displayType) &&
          query.columns?.length !== 0
        ) {
          requestData.topEvents = widget.limit ?? TOP_N;
          requestData.field = [...query.columns, ...query.aggregates];

          // Compare field and orderby as aliases to ensure requestData has
          // the orderby selected
          // If the orderby is an equation alias, do not inject it
          const orderby = trimStart(query.orderby, '-');
          if (
            query.orderby &&
            !isEquationAlias(orderby) &&
            !requestData.field.includes(orderby)
          ) {
            requestData.field.push(orderby);
          }

          // The "Other" series is only included when there is one
          // y-axis and one query
          requestData.excludeOther =
            query.aggregates.length !== 1 || widget.queries.length !== 1;

          if (isEquation(trimStart(query.orderby, '-'))) {
            const nextEquationIndex = getNumEquations(query.aggregates);
            const isDescending = query.orderby.startsWith('-');
            const prefix = isDescending ? '-' : '';

            // Construct the alias form of the equation and inject it into the request
            requestData.orderby = `${prefix}equation[${nextEquationIndex}]`;
            requestData.field = [
              ...query.columns,
              ...query.aggregates,
              trimStart(query.orderby, '-'),
            ];
          }
        }
      }
      return doEventsRequest(api, requestData);
    });

    let completed = 0;
    let isMetricsData: boolean | undefined;
    promises.forEach(async (promise, requestIndex) => {
      try {
        const rawResults = await promise;
        if (!this._isMounted) {
          return;
        }
        // If one of the queries is sampled, then mark the whole thing as sampled
        isMetricsData =
          isMetricsData === false
            ? false
            : getIsMetricsDataFromSeriesResponse(rawResults);
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          const timeseriesResults = [...(prevState.timeseriesResults ?? [])];
          const transformedResult = this.config.transformSeries!(
            rawResults,
            widget.queries[requestIndex],
            organization
          );
          // When charting timeseriesData on echarts, color association to a timeseries result
          // is order sensitive, ie series at index i on the timeseries array will use color at
          // index i on the color array. This means that on multi series results, we need to make
          // sure that the order of series in our results do not change between fetches to avoid
          // coloring inconsistencies between renders.
          transformedResult.forEach((result, resultIndex) => {
            timeseriesResults[requestIndex * transformedResult.length + resultIndex] =
              result;
          });

          const rawResultsClone = cloneDeep(prevState.rawResults ?? []);
          rawResultsClone[requestIndex] = rawResults;

          onDataFetched?.({timeseriesResults});

          return {
            ...prevState,
            timeseriesResults,
            rawResults: rawResultsClone,
          };
        });
      } catch (err) {
        const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
        this.setState({errorMessage});
      } finally {
        completed++;
        if (!this._isMounted) {
          return;
        }
        this.context?.setIsMetricsData(isMetricsData);
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          return {
            ...prevState,
            loading: completed === promises.length ? false : true,
          };
        });
      }
    });
  }

  fetchData() {
    const {widget} = this.props;

    const queryFetchID = Symbol('queryFetchID');
    this.setState({loading: true, errorMessage: undefined, queryFetchID});

    if (
      [DisplayType.TABLE, DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(
        widget.displayType
      )
    ) {
      this.fetchTableData(queryFetchID);
    } else {
      this.fetchTimeseriesData(queryFetchID, widget.displayType);
    }
  }

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage, pageLinks} =
      this.state;

    const filteredTimeseriesResults = timeseriesResults?.filter(result => !!result);
    return children({
      loading,
      timeseriesResults: filteredTimeseriesResults,
      tableResults,
      errorMessage,
      pageLinks,
    });
  }
}

export default WidgetQueries;
