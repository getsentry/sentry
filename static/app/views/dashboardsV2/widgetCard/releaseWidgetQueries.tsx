import {Component} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import trimStart from 'lodash/trimStart';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
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
import {
  DEFAULT_TABLE_LIMIT,
  DisplayType,
  Widget,
  WidgetQuery,
  WidgetType,
} from '../types';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  DerivedStatusFields,
  DISABLED_SORT,
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
  orderby: string,
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

  const rawOrderby = trimStart(orderby, '-');
  const unsupportedOrderby =
    DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';

  if (rawOrderby && !!!unsupportedOrderby && !!!fields.includes(rawOrderby)) {
    if (!!!injectedFields.includes(rawOrderby)) {
      injectedFields.push(rawOrderby);
    }
  }

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

export function requiresCustomReleaseSorting(query: WidgetQuery): boolean {
  const useMetricsAPI = !!!query.columns.includes('session.status');
  const rawOrderby = trimStart(query.orderby, '-');
  return useMetricsAPI && rawOrderby === 'release';
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

    if (requiresCustomReleaseSorting(this.props.widget.queries[0])) {
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
      requiresCustomReleaseSorting(widget.queries[0]) &&
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

  async fetchData() {
    const {
      selection,
      api,
      organization,
      widget: initialWidget,
      cursor,
      onDataFetched,
    } = this.props;
    const {releases} = this.state;

    // HACK: Cloning the widget because we're modifying the query conditions
    // to support sorting by release
    const widget = cloneDeep(initialWidget);

    const isCustomReleaseSorting = requiresCustomReleaseSorting(widget.queries[0]);
    const isDescending = widget.queries[0].orderby.startsWith('-');
    const useSessionAPI = widget.queries[0].columns.includes('session.status');

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

    if (!useSessionAPI) {
      widget.queries.forEach(query => {
        query.conditions =
          query.conditions + (releaseCondition === '' ? '' : ` ${releaseCondition}`);
      });
    }

    let responses: [MetricsApiResponse | SessionApiResponse, string, ResponseMeta][] = [];

    try {
      responses = await Promise.all(
        widget.queries.map(query => {
          const requestGenerator = [DisplayType.TABLE, DisplayType.BIG_NUMBER].includes(
            widget.displayType
          )
            ? this.config.getTableRequest
            : this.config.getSeriesRequest;
          return requestGenerator!(
            api,
            query,
            {
              organization,
              pageFilters: selection,
            },
            this.limit,
            cursor
          );
        })
      );
    } catch (err) {
      const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
      if (!this._isMounted) {
        return;
      }
      this.setState({errorMessage});
    } finally {
      if (!this._isMounted) {
        return;
      }
    }

    responses.forEach(([data, _textstatus, response], requestIndex) => {
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

        let tableResults: TableDataWithTitle[] | undefined;
        const timeseriesResults = [...(prevState.timeseriesResults ?? [])];
        if ([DisplayType.TABLE, DisplayType.BIG_NUMBER].includes(widget.displayType)) {
          // Transform to fit the table format
          const tableData = this.config.transformTable(
            data,
            widget.queries[0]
          ) as TableDataWithTitle; // Cast so we can add the title.
          tableData.title = widget.queries[requestIndex]?.name ?? '';
          tableResults = [...(prevState.tableResults ?? []), tableData];
        } else {
          // Transform to fit the chart format
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
    });

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
