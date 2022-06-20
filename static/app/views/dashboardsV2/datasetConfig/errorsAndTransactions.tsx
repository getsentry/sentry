import {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
  PageFilters,
  TagCollection,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {MetaType} from 'sentry/utils/discover/eventView';
import {
  getFieldRenderer,
  RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/discover/fields';
import {
  DiscoverQueryRequestParams,
  doDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {Container} from 'sentry/utils/discover/styles';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import {DisplayType, WidgetQuery} from '../types';
import {eventViewFromWidget, getDashboardsMEPQueryParams} from '../utils';
import WidgetQueries, {
  flattenMultiSeriesDataWithGrouping,
  transformSeries,
} from '../widgetCard/widgetQueries';

import {DatasetConfig, handleOrderByReset} from './base';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count()'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count()'],
  conditions: '',
  orderby: '-count()',
};

type SeriesWithOrdering = [order: number, series: Series];

export const ErrorsAndTransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  WidgetQueries: props => <WidgetQueries {...props} />,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  getCustomFieldRenderer: getCustomEventsFieldRenderer,
  getTableFieldOptions: getEventsTableFieldOptions,
  handleOrderByReset,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.BIG_NUMBER,
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
    DisplayType.WORLD_MAP,
  ],
  getTableRequest: (
    api: Client,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    limit?: number,
    cursor?: string,
    referrer?: string
  ) => {
    const shouldUseEvents = organization.features.includes(
      'discover-frontend-use-events-endpoint'
    );
    const url = shouldUseEvents
      ? `/organizations/${organization.slug}/events/`
      : `/organizations/${organization.slug}/eventsv2/`;
    return getEventsRequest(
      url,
      api,
      query,
      organization,
      pageFilters,
      limit,
      cursor,
      referrer
    );
  },
  getWorldMapRequest: (
    api: Client,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    limit?: number,
    cursor?: string,
    referrer?: string
  ) => {
    return getEventsRequest(
      `/organizations/${organization.slug}/events-geo/`,
      api,
      query,
      organization,
      pageFilters,
      limit,
      cursor,
      referrer
    );
  },
  transformSeries: transformEventsResponseToSeries,
  transformTable: transformEventsResponseToTable,
};

function getEventsTableFieldOptions(organization: Organization, tags?: TagCollection) {
  const measurements = getMeasurements();

  return generateFieldOptions({
    organization,
    tagKeys: Object.values(tags ?? {}).map(({key}) => key),
    measurementKeys: Object.values(measurements).map(({key}) => key),
    spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
  });
}

function transformEventsResponseToTable(
  data: TableData | EventsTableData,
  _widgetQuery: WidgetQuery,
  organization: Organization
): TableData {
  let tableData = data;
  const shouldUseEvents = organization.features.includes(
    'discover-frontend-use-events-endpoint'
  );
  // events api uses a different response format so we need to construct tableData differently
  if (shouldUseEvents) {
    const fieldsMeta = (data as EventsTableData).meta?.fields;
    tableData = {
      ...data,
      meta: {...fieldsMeta, isMetricsData: data.meta?.isMetricsData},
    } as TableData;
  }
  return tableData as TableData;
}

function transformEventsResponseToSeries(
  data: EventsStats | MultiSeriesEventsStats,
  widgetQuery: WidgetQuery,
  organization: Organization
): Series[] {
  let output: Series[] = [];
  const queryAlias = widgetQuery.name;

  const widgetBuilderNewDesign =
    organization.features.includes('new-widget-builder-experience-design') || false;

  if (isMultiSeriesStats(data)) {
    let seriesWithOrdering: SeriesWithOrdering[] = [];
    const isMultiSeriesDataWithGrouping =
      widgetQuery.aggregates.length > 1 && widgetQuery.columns.length;

    // Convert multi-series results into chartable series. Multi series results
    // are created when multiple yAxis are used. Convert the timeseries
    // data into a multi-series data set.  As the server will have
    // replied with a map like: {[titleString: string]: EventsStats}
    if (widgetBuilderNewDesign && isMultiSeriesDataWithGrouping) {
      seriesWithOrdering = flattenMultiSeriesDataWithGrouping(data, queryAlias);
    } else {
      seriesWithOrdering = Object.keys(data).map((seriesName: string) => {
        const prefixedName = queryAlias ? `${queryAlias} : ${seriesName}` : seriesName;
        const seriesData: EventsStats = data[seriesName];
        return [seriesData.order || 0, transformSeries(seriesData, prefixedName)];
      });
    }

    output = [
      ...seriesWithOrdering
        .sort((itemA, itemB) => itemA[0] - itemB[0])
        .map(item => item[1]),
    ];
  } else {
    const field = widgetQuery.aggregates[0];
    const prefixedName = queryAlias ? `${queryAlias} : ${field}` : field;
    const transformed = transformSeries(data, prefixedName);
    output.push(transformed);
  }

  return output;
}

function renderEventIdAsLinkable(data, {eventView, organization}: RenderFunctionBaggage) {
  const id: string | unknown = data?.id;
  if (!eventView || typeof id !== 'string') {
    return null;
  }

  const eventSlug = generateEventSlug(data);

  const target = eventDetailsRouteWithEventView({
    orgSlug: organization.slug,
    eventSlug,
    eventView,
  });

  return (
    <Tooltip title={t('View Event')}>
      <Link data-test-id="view-event" to={target}>
        <Container>{getShortEventId(id)}</Container>
      </Link>
    </Tooltip>
  );
}

function renderTraceAsLinkable(
  data,
  {eventView, organization, location}: RenderFunctionBaggage
) {
  const id: string | unknown = data?.trace;
  if (!eventView || typeof id !== 'string') {
    return null;
  }
  const dateSelection = eventView.normalizeDateSelection(location);
  const target = getTraceDetailsUrl(organization, String(data.trace), dateSelection, {});

  return (
    <Tooltip title={t('View Trace')}>
      <Link data-test-id="view-trace" to={target}>
        <Container>{getShortEventId(id)}</Container>
      </Link>
    </Tooltip>
  );
}

export function getCustomEventsFieldRenderer(
  field: string,
  meta: MetaType,
  organization?: Organization
) {
  const isAlias = !organization?.features.includes(
    'discover-frontend-use-events-endpoint'
  );

  if (field === 'id') {
    return renderEventIdAsLinkable;
  }

  if (field === 'trace') {
    return renderTraceAsLinkable;
  }

  return getFieldRenderer(field, meta, isAlias);
}

function getEventsRequest(
  url: string,
  api: Client,
  query: WidgetQuery,
  organization: Organization,
  pageFilters: PageFilters,
  limit?: number,
  cursor?: string,
  referrer?: string
) {
  const isMEPEnabled = organization.features.includes('dashboards-mep');

  const eventView = eventViewFromWidget('', query, pageFilters);

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    ...getDashboardsMEPQueryParams(isMEPEnabled),
  };

  if (query.orderby) {
    params.sort = typeof query.orderby === 'string' ? [query.orderby] : query.orderby;
  }

  // TODO: eventually need to replace this with just EventsTableData as we deprecate eventsv2
  return doDiscoverQuery<TableData | EventsTableData>(api, url, {
    ...eventView.generateQueryStringObject(),
    ...params,
  });
}
