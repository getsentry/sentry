import {Component} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import trimStart from 'lodash/trimStart';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {doMetricsRequest} from 'sentry/actionCreators/metrics';
import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import {Client, ResponseMeta} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {
  MetricsApiResponse,
  OrganizationSummary,
  PageFilters,
  Release,
  SessionApiResponse,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {stripDerivedMetricsPrefix} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';

import {getDatasetConfig} from '../datasetConfig/base';
import {DEFAULT_TABLE_LIMIT, DisplayType, Widget, WidgetType} from '../types';
import {getWidgetInterval} from '../utils';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  DerivedStatusFields,
  DISABLED_SORT,
  FIELD_TO_METRICS_EXPRESSION,
  METRICS_EXPRESSION_TO_FIELD,
} from '../widgetBuilder/releaseWidget/fields';

type Props = {
  api: Client;
  children: (
    props: Pick<
      State,
      'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage' | 'pageLinks'
    >
  ) => React.ReactNode;
  organization: OrganizationSummary;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  includeAllArgs?: boolean;
  limit?: number;
  onDataFetched?: (results: {
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
  }) => void;
};

type State = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: string;
  queryFetchID?: symbol;
  rawResults?: SessionApiResponse[] | MetricsApiResponse[];
  releases?: Release[];
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
};

function fieldsToDerivedMetrics(field: string): string {
  return FIELD_TO_METRICS_EXPRESSION[field] ?? field;
}

export function derivedMetricsToField(field: string): string {
  return METRICS_EXPRESSION_TO_FIELD[field] ?? field;
}

/**
 * Given a list of requested fields, this function returns
 * 'aggregates' which is a list of aggregate functions that
 * can be passed to either Metrics or Sessions endpoints,
 * 'derivedStatusFields' which need to be requested from the
 * Metrics endpoint and 'injectFields' which are fields not
 * requested but required to calculate the value of a derived
 * status field so will need to be stripped away in post processing.
 */
export function resolveDerivedStatusFields(
  fields: string[],
  useSessionAPI: boolean
): {
  aggregates: string[];
  derivedStatusFields: string[];
  injectedFields: string[];
} {
  const aggregates = fields.map(stripDerivedMetricsPrefix);
  const derivedStatusFields = aggregates.filter(agg =>
    Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
  );

  const injectedFields: string[] = [];

  if (!!!useSessionAPI) {
    return {aggregates, derivedStatusFields, injectedFields};
  }

  derivedStatusFields.forEach(field => {
    const result = field.match(DERIVED_STATUS_METRICS_PATTERN);
    if (result) {
      if (result[2] === 'user' && !!!aggregates.includes('count_unique(user)')) {
        injectedFields.push('count_unique(user)');
        aggregates.push('count_unique(user)');
      }
      if (result[2] === 'session' && !!!aggregates.includes('sum(session)')) {
        injectedFields.push('sum(session)');
        aggregates.push('sum(session)');
      }
    }
  });

  return {aggregates, derivedStatusFields, injectedFields};
}

class ReleaseWidgetQueries extends Component<Props, State> {
  state: State = {
    loading: true,
    queryFetchID: undefined,
    errorMessage: undefined,
    timeseriesResults: undefined,
    rawResults: undefined,
    tableResults: undefined,
    releases: undefined,
  };

  componentDidMount() {
    this._isMounted = true;

    if (this.requiresCustomReleaseSorting()) {
      this.fetchReleasesAndData();
      return;
    }
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {loading, rawResults} = this.state;
    const {selection, widget, organization, limit, cursor} = this.props;
    const ignroredWidgetProps = [
      'queries',
      'title',
      'id',
      'layout',
      'tempId',
      'widgetType',
    ];
    const ignoredQueryProps = ['name', 'fields', 'aggregates', 'columns'];
    const widgetQueryNames = widget.queries.map(q => q.name);
    const prevWidgetQueryNames = prevProps.widget.queries.map(q => q.name);

    if (
      this.requiresCustomReleaseSorting() &&
      (!isEqual(
        widget.queries.map(q => q.orderby),
        prevProps.widget.queries.map(q => q.orderby)
      ) ||
        !isSelectionEqual(selection, prevProps.selection) ||
        !isEqual(organization, prevProps.organization))
    ) {
      this.fetchReleasesAndData();
      return;
    }

    if (
      limit !== prevProps.limit ||
      organization.slug !== prevProps.organization.slug ||
      !isSelectionEqual(selection, prevProps.selection) ||
      // If the widget changed (ignore unimportant fields, + queries as they are handled lower)
      !isEqual(
        omit(widget, ignroredWidgetProps),
        omit(prevProps.widget, ignroredWidgetProps)
      ) ||
      // If the queries changed (ignore unimportant name, + fields as they are handled lower)
      !isEqual(
        widget.queries.map(q => omit(q, ignoredQueryProps)),
        prevProps.widget.queries.map(q => omit(q, ignoredQueryProps))
      ) ||
      // If the fields changed (ignore falsy/empty fields -> they can happen after clicking on Add Overlay)
      !isEqual(
        widget.queries.flatMap(q => q.fields?.filter(field => !!field)),
        prevProps.widget.queries.flatMap(q => q.fields?.filter(field => !!field))
      ) ||
      !isEqual(
        widget.queries.flatMap(q => q.aggregates.filter(aggregate => !!aggregate)),
        prevProps.widget.queries.flatMap(q =>
          q.aggregates.filter(aggregate => !!aggregate)
        )
      ) ||
      !isEqual(
        widget.queries.flatMap(q => q.columns.filter(column => !!column)),
        prevProps.widget.queries.flatMap(q => q.columns.filter(column => !!column))
      ) ||
      cursor !== prevProps.cursor
    ) {
      this.fetchData();
      return;
    }
    if (
      !loading &&
      !isEqual(widgetQueryNames, prevWidgetQueryNames) &&
      rawResults?.length === widget.queries.length
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(prevState => {
        return {
          ...prevState,
          timeseriesResults: prevState.rawResults?.flatMap((rawResult, index) =>
            this.config.transformSeries!(rawResult, widget.queries[index])
          ),
        };
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  private _isMounted: boolean = false;
  config = getDatasetConfig(WidgetType.RELEASE);

  get limit() {
    const {limit} = this.props;

    switch (this.props.widget.displayType) {
      case DisplayType.TOP_N:
        return TOP_N;
      case DisplayType.TABLE:
        return limit ?? DEFAULT_TABLE_LIMIT;
      case DisplayType.BIG_NUMBER:
        return 1;
      default:
        return limit ?? 20; // TODO(dam): Can be changed to undefined once [INGEST-1079] is resolved
    }
  }

  requiresCustomReleaseSorting() {
    const {widget} = this.props;
    const useMetricsAPI = !!!widget.queries[0].columns.includes('session.status');
    const rawOrderby = trimStart(widget.queries[0].orderby, '-');
    return useMetricsAPI && rawOrderby === 'release';
  }

  async fetchReleasesAndData() {
    const {selection, api, organization} = this.props;
    const {environments, projects} = selection;

    try {
      const releases = await api.requestPromise(
        `/organizations/${organization.slug}/releases/`,
        {
          method: 'GET',
          data: {
            sort: 'date',
            project: projects,
            per_page: 50,
            environments,
          },
        }
      );
      if (!this._isMounted) {
        return;
      }
      this.setState({releases});
    } catch (error) {
      addErrorMessage(
        error.responseJSON ? error.responseJSON.error : t('Error sorting by releases')
      );
    }
    this.fetchData();
  }

  fetchData() {
    const {selection, api, organization, widget, includeAllArgs, cursor, onDataFetched} =
      this.props;

    if (widget.displayType === DisplayType.WORLD_MAP) {
      this.setState({errorMessage: t('World Map is not supported by metrics.')});
      return;
    }

    const queryFetchID = Symbol('queryFetchID');

    this.setState({
      loading: true,
      errorMessage: undefined,
      timeseriesResults: [],
      rawResults: [],
      tableResults: [],
      queryFetchID,
    });
    const {environments, projects, datetime} = selection;
    const {start, end, period} = datetime;

    const promises: Promise<
      MetricsApiResponse | [MetricsApiResponse, string, ResponseMeta] | SessionApiResponse
    >[] = [];

    // Only time we need to use sessions API is when session.status is requested
    // as a group by.
    const useSessionAPI = widget.queries[0].columns.includes('session.status');
    const isDescending = widget.queries[0].orderby.startsWith('-');
    const rawOrderby = trimStart(widget.queries[0].orderby, '-');
    const unsupportedOrderby =
      DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';

    // Temporary solution to support sorting on releases when querying the
    // Metrics API:
    //
    // We first request the top 50 recent releases from postgres. Note that the
    // release request is based on the project and environment selected in the
    // page filters.
    //
    // We then construct a massive OR condition and append it to any specified
    // filter condition. We also maintain an ordered array of release versions
    // to order the results returned from the metrics endpoint.
    //
    // Also note that we request a limit of 100 on the metrics endpoint, this
    // is because in a query, the limit should be applied after the results are
    // sorted based on the release version. The larger number of rows we
    // request, the more accurate our results are going to be.
    //
    // After the results are sorted, we truncate the data to the requested
    // limit. This will result in a few edge cases:
    //
    //   1. low to high sort may not show releases at the beginning of the
    //      selected period if there are more than 50 releases in the selected
    //      period.
    //
    //   2. if a recent release is not returned due to the 100 row limit
    //      imposed on the metrics query the user won't see it on the
    //      table/chart/
    //
    const isCustomReleaseSorting = this.requiresCustomReleaseSorting();
    const {releases} = this.state;
    const interval = getWidgetInterval(
      widget,
      {start, end, period},
      // requesting low fidelity for release sort because metrics api can't return 100 rows of high fidelity series data
      isCustomReleaseSorting ? 'low' : undefined
    );
    let releaseCondition = '';
    const releasesArray: string[] = [];
    if (isCustomReleaseSorting) {
      if (releases && releases.length === 1) {
        releaseCondition += `release:${releases[0].version}`;
        releasesArray.push(releases[0].version);
      }
      if (releases && releases.length > 1) {
        releaseCondition += 'release:[' + releases[0].version;
        releasesArray.push(releases[0].version);
        for (let i = 1; i < releases.length; i++) {
          releaseCondition += ',' + releases[i].version;
          releasesArray.push(releases[i].version);
        }
        releaseCondition += ']';

        if (!!!isDescending) {
          releasesArray.reverse();
        }
      }
    }

    const {aggregates, injectedFields} = resolveDerivedStatusFields(
      widget.queries[0].aggregates,
      useSessionAPI
    );
    const columns = widget.queries[0].columns;

    const includeSeries = widget.displayType !== DisplayType.TABLE ? 1 : 0;
    const includeTotals =
      widget.displayType === DisplayType.TABLE ||
      widget.displayType === DisplayType.BIG_NUMBER ||
      columns.length > 0
        ? 1
        : 0;

    widget.queries.forEach(query => {
      let requestData;
      let requester;
      if (useSessionAPI) {
        const sessionAggregates = aggregates.filter(
          agg =>
            !!!Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
        );
        requestData = {
          field: sessionAggregates,
          orgSlug: organization.slug,
          end,
          environment: environments,
          groupBy: columns,
          limit: undefined,
          orderBy: '', // Orderby not supported with session.status
          interval,
          project: projects,
          query: query.conditions,
          start,
          statsPeriod: period,
          includeAllArgs,
          cursor,
        };
        requester = doSessionsRequest;
      } else {
        requestData = {
          field: aggregates.map(fieldsToDerivedMetrics),
          orgSlug: organization.slug,
          end,
          environment: environments,
          groupBy: columns.map(fieldsToDerivedMetrics),
          limit: columns.length === 0 ? 1 : isCustomReleaseSorting ? 100 : this.limit,
          orderBy: unsupportedOrderby
            ? ''
            : isDescending
            ? `-${fieldsToDerivedMetrics(rawOrderby)}`
            : fieldsToDerivedMetrics(rawOrderby),
          interval,
          project: projects,
          query:
            query.conditions + (releaseCondition === '' ? '' : ` ${releaseCondition}`),
          start,
          statsPeriod: period,
          includeAllArgs,
          cursor,
          includeSeries,
          includeTotals,
        };
        requester = doMetricsRequest;

        if (
          rawOrderby &&
          !!!unsupportedOrderby &&
          !!!aggregates.includes(rawOrderby) &&
          !!!columns.includes(rawOrderby)
        ) {
          requestData.field = [...requestData.field, fieldsToDerivedMetrics(rawOrderby)];
          if (!!!injectedFields.includes(rawOrderby)) {
            injectedFields.push(rawOrderby);
          }
        }
      }

      promises.push(requester(api, requestData));
    });

    let completed = 0;
    promises.forEach(async (promise, requestIndex) => {
      try {
        const res = await promise;
        let data: SessionApiResponse | MetricsApiResponse;
        let response: ResponseMeta;
        if (Array.isArray(res)) {
          data = res[0];
          response = res[2];
        } else {
          data = res;
        }
        if (!this._isMounted) {
          return;
        }
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          if (releasesArray.length) {
            data.groups.sort(function (group1, group2) {
              const release1 = group1.by.release;
              const release2 = group2.by.release;
              return releasesArray.indexOf(release1) - releasesArray.indexOf(release2);
            });
            data.groups = data.groups.slice(0, this.limit);
          }

          // Transform to fit the table format
          let tableResults: TableDataWithTitle[] | undefined;
          if (includeTotals) {
            const tableData = this.config.transformTable(
              data,
              widget.queries[0]
            ) as TableDataWithTitle; // Cast so we can add the title.
            tableData.title = widget.queries[requestIndex]?.name ?? '';
            tableResults = [...(prevState.tableResults ?? []), tableData];
          } else {
            tableResults = undefined;
          }

          // Transform to fit the chart format
          const timeseriesResults = [...(prevState.timeseriesResults ?? [])];
          if (includeSeries) {
            const transformedResult = this.config.transformSeries!(
              data,
              widget.queries[requestIndex]
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
          }

          onDataFetched?.({timeseriesResults, tableResults});

          if ([DisplayType.TABLE, DisplayType.BIG_NUMBER].includes(widget.displayType)) {
            return {
              ...prevState,
              errorMessage: undefined,
              tableResults,
              pageLinks: response?.getResponseHeader('link') ?? undefined,
            };
          }

          const rawResultsClone = cloneDeep(prevState.rawResults ?? []);
          rawResultsClone[requestIndex] = data;

          return {
            ...prevState,
            errorMessage: undefined,
            timeseriesResults,
            rawResults: rawResultsClone,
            pageLinks: response?.getResponseHeader('link') ?? undefined,
          };
        });
      } catch (err) {
        const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
        if (!this._isMounted) {
          return;
        }
        this.setState({errorMessage});
      } finally {
        completed++;
        if (!this._isMounted) {
          return;
        }
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

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage, pageLinks} =
      this.state;

    return children({
      loading,
      timeseriesResults,
      tableResults,
      errorMessage,
      pageLinks,
    });
  }
}

export default ReleaseWidgetQueries;
