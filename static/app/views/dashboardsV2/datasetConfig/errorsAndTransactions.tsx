import trimStart from 'lodash/trimStart';

import {doEventsRequest} from 'sentry/actionCreators/events';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {EventsStats, MultiSeriesEventsStats} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {MetaType} from 'sentry/utils/discover/eventView';
import {
  getFieldRenderer,
  RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {isEquation, isEquationAlias} from 'sentry/utils/discover/fields';
import {
  DiscoverQueryRequestParams,
  doDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {Container} from 'sentry/utils/discover/styles';
import {TOP_N} from 'sentry/utils/discover/types';
import {
  eventDetailsRouteWithEventView,
  generateEventSlug,
} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

import {DEFAULT_TABLE_LIMIT, DisplayType, Widget, WidgetQuery} from '../types';
import {
  eventViewFromWidget,
  getDashboardsMEPQueryParams,
  getNumEquations,
  getWidgetInterval,
} from '../utils';

import {ContextualProps, DatasetConfig} from './base';

export const ErrorsAndTransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  getTableRequests,
  getTimeseriesRequests,
  getCustomFieldRenderer: getCustomEventsFieldRenderer,
  transformSeries: (_data: EventsStats | MultiSeriesEventsStats) => {
    return [] as Series[];
  },
  transformTable: transformEventsResponseToTable,
};

function transformEventsResponseToTable(
  data: TableData | EventsTableData,
  _widgetQuery: WidgetQuery,
  contextualProps?: ContextualProps
): TableData {
  let tableData = data;
  const shouldUseEvents =
    contextualProps?.organization?.features.includes(
      'discover-frontend-use-events-endpoint'
    ) || false;
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
  contextualProps?: ContextualProps
) {
  const isAlias = !contextualProps?.organization?.features.includes(
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

function getTableRequests(
  widget: Widget,
  contextualProps: ContextualProps,
  limit?: number,
  cursor?: string
) {
  const shouldUseEvents = contextualProps?.organization?.features.includes(
    'discover-frontend-use-events-endpoint'
  );
  const isMEPEnabled =
    contextualProps?.organization?.features.includes('dashboards-mep') ?? false;

  // Table, world map, and stat widgets use table results and need
  // to do a discover 'table' query instead of a 'timeseries' query.

  return widget.queries.map(query => {
    const eventView = eventViewFromWidget(
      widget.title,
      query,
      contextualProps?.pageFilters!
    );

    let url: string = '';
    const params: DiscoverQueryRequestParams = {
      per_page: limit ?? DEFAULT_TABLE_LIMIT,
      cursor,
      ...getDashboardsMEPQueryParams(isMEPEnabled),
    };

    if (query.orderby) {
      params.sort = typeof query.orderby === 'string' ? [query.orderby] : query.orderby;
    }

    const eventsUrl = shouldUseEvents
      ? `/organizations/${contextualProps.organization?.slug}/events/`
      : `/organizations/${contextualProps.organization?.slug}/eventsv2/`;
    if (widget.displayType === 'table') {
      url = eventsUrl;
      params.referrer = 'api.dashboards.tablewidget';
    } else if (widget.displayType === 'big_number') {
      url = eventsUrl;
      params.per_page = 1;
      params.referrer = 'api.dashboards.bignumberwidget';
    } else if (widget.displayType === 'world_map') {
      url = `/organizations/${contextualProps.organization?.slug}/events-geo/`;
      delete params.per_page;
      params.referrer = 'api.dashboards.worldmapwidget';
    } else {
      throw Error(
        'Expected widget displayType to be either big_number, table or world_map'
      );
    }

    // TODO: eventually need to replace this with just EventsTableData as we deprecate eventsv2
    return doDiscoverQuery<TableData | EventsTableData>(contextualProps.api!, url, {
      ...eventView.generateQueryStringObject(),
      ...params,
    });
  });
}

function getTimeseriesRequests(widget, contextualProps) {
  const {environments, projects} = contextualProps?.pageFilters;
  const {start, end, period: statsPeriod} = contextualProps?.pageFilters.datetime;
  const interval = getWidgetInterval(widget, {
    start,
    end,
    period: statsPeriod,
  });
  const isMEPEnabled =
    contextualProps?.organization?.features.includes('dashboards-mep') ?? false;
  return widget.queries.map(query => {
    let requestData;
    if (widget.displayType === 'top_n') {
      requestData = {
        organization: contextualProps?.organization,
        interval,
        start,
        end,
        project: projects,
        environment: environments,
        period: statsPeriod,
        query: query.conditions,
        yAxis: query.aggregates[query.aggregates.length - 1],
        includePrevious: false,
        referrer: `api.dashboards.widget.${widget.displayType}-chart`,
        partial: true,
        topEvents: TOP_N,
        field: [...query.columns, ...query.aggregates],
        queryExtras: getDashboardsMEPQueryParams(isMEPEnabled),
      };
      if (query.orderby) {
        requestData.orderby = query.orderby;
      }
    } else {
      requestData = {
        organization: contextualProps?.organization,
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
        referrer: `api.dashboards.widget.${widget.displayType}-chart`,
        partial: true,
        queryExtras: getDashboardsMEPQueryParams(isMEPEnabled),
      };

      if (
        contextualProps?.organization?.features.includes(
          'new-widget-builder-experience-design'
        ) &&
        [DisplayType.AREA, DisplayType.BAR, DisplayType.LINE].includes(
          widget.displayType
        ) &&
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
    return doEventsRequest(contextualProps?.api, requestData);
  });
}
