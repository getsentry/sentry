import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  getAggregateAlias,
  isAggregateFieldOrEquation,
} from 'sentry/utils/discover/fields';
import {decodeBoolean, decodeList, decodeScalar} from 'sentry/utils/queryString';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import {
  eventViewFromWidget,
  getFieldsFromEquations,
  getWidgetInterval,
} from 'sentry/views/dashboards/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export function getWidgetExploreUrl(
  widget: Widget,
  selection: PageFilters,
  organization: Organization
) {
  const eventView = eventViewFromWidget(widget.title, widget.queries[0]!, selection);
  const {query: locationQueryParams} = eventView.getResultsViewUrlTarget(
    organization,
    false,
    undefined
  );

  // Pull a max of 3 valid Y-Axis from the widget
  const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
  locationQueryParams.yAxes = [
    ...new Set(
      widget.queries[0]!.aggregates.filter(aggregate => yAxisOptions.includes(aggregate))
    ),
  ].slice(0, 3);

  // Visualization specific transforms
  let exploreMode: Mode | undefined = undefined;
  let chartType: ChartType = ChartType.LINE;
  switch (widget.displayType) {
    case DisplayType.BAR:
      exploreMode = Mode.AGGREGATE;
      chartType = ChartType.BAR;
      break;
    case DisplayType.LINE:
      exploreMode = Mode.AGGREGATE;
      chartType = ChartType.LINE;
      break;
    case DisplayType.AREA:
      exploreMode = Mode.AGGREGATE;
      chartType = ChartType.AREA;
      break;
    case DisplayType.TABLE:
    case DisplayType.BIG_NUMBER:
      exploreMode = Mode.SAMPLES;
      break;
    default:
      break;
  }

  // Equation fields need to have their terms explicitly selected as columns in the discover table
  const fields =
    Array.isArray(locationQueryParams.field) || !defined(locationQueryParams.field)
      ? locationQueryParams.field
      : [locationQueryParams.field];

  const query = widget.queries[0]!;
  const queryFields = defined(query.fields)
    ? query.fields
    : [...query.columns, ...query.aggregates];

  // Updates fields by adding any individual terms from equation fields as a column
  getFieldsFromEquations(queryFields).forEach(term => {
    if (Array.isArray(fields) && !fields.includes(term)) {
      fields.unshift(term);
    }
  });
  locationQueryParams.field = fields;

  const datetime = {
    end: decodeScalar(locationQueryParams.end) ?? null,
    period: decodeScalar(locationQueryParams.statsPeriod) ?? null,
    start: decodeScalar(locationQueryParams.start) ?? null,
    utc: decodeBoolean(locationQueryParams.utc) ?? null,
  };

  let groupBy = fields?.filter(field => !isAggregateFieldOrEquation(field));
  if (groupBy && groupBy.length === 0) {
    // Force the groupBy to be an array with a single empty string
    // so that qs.stringify appends the key to the URL. If the key
    // is not present, the Explore UI will assign a default groupBy
    // which we do not want if the user has not specified a groupBy.
    groupBy = [''];
  }

  const queryParams = {
    // Page filters should propagate
    selection: {
      ...selection,
      datetime,
    },
    organization,
    mode: exploreMode,
    visualize: [
      {
        chartType,
        yAxes: locationQueryParams.yAxes,
      },
    ],
    groupBy,
    field: decodeList(locationQueryParams.field),
    query: decodeScalar(locationQueryParams.query),
    sort:
      defined(fields) && defined(locationQueryParams.sort)
        ? _getSort(fields, locationQueryParams.sort as string)
        : undefined,
    interval:
      decodeScalar(locationQueryParams.interval) ??
      getWidgetInterval(widget.displayType, selection.datetime),
  };

  return getExploreUrl(queryParams);
}

function _getSort(fields: string[], sort: string) {
  const descending = sort.startsWith('-');
  const rawSort = descending ? sort.slice(1) : sort;
  const sortedField = fields?.find(field => getAggregateAlias(field) === rawSort);
  return descending ? `-${sortedField}` : sortedField;
}
