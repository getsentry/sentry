import pick from 'lodash/pick';
import * as qs from 'query-string';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  getAggregateAlias,
  isAggregateFieldOrEquation,
} from 'sentry/utils/discover/fields';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import {
  eventViewFromWidget,
  getFieldsFromEquations,
  getWidgetInterval,
} from 'sentry/views/dashboards/utils';
import type {ResultMode} from 'sentry/views/explore/hooks/useResultsMode';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export function getWidgetExploreUrl(
  widget: Widget,
  selection: PageFilters,
  organization: Organization
) {
  const eventView = eventViewFromWidget(widget.title, widget.queries[0], selection);
  const {query: locationQueryParams} = eventView.getResultsViewUrlTarget(
    organization.slug,
    false,
    undefined
  );

  // Pull a max of 3 valid Y-Axis from the widget
  const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
  locationQueryParams.yAxes = [
    ...new Set(
      widget.queries[0].aggregates.filter(aggregate => yAxisOptions.includes(aggregate))
    ),
  ].slice(0, 3);

  // Visualization specific transforms
  let exploreMode: ResultMode | undefined = undefined;
  switch (widget.displayType) {
    case DisplayType.BAR:
      exploreMode = 'aggregate';
      locationQueryParams.chartType = ChartType.BAR.toString();
      break;
    case DisplayType.LINE:
      exploreMode = 'aggregate';
      locationQueryParams.chartType = ChartType.LINE.toString();
      break;
    case DisplayType.AREA:
      exploreMode = 'aggregate';
      locationQueryParams.chartType = ChartType.AREA.toString();
      break;
    case DisplayType.TABLE:
    case DisplayType.BIG_NUMBER:
      exploreMode = 'samples';
      break;
    default:
      break;
  }

  // Equation fields need to have their terms explicitly selected as columns in the discover table
  const fields =
    Array.isArray(locationQueryParams.field) || !defined(locationQueryParams.field)
      ? locationQueryParams.field
      : [locationQueryParams.field];

  const query = widget.queries[0];
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

  const queryParams = {
    // Page filters should propagate
    ...pick(locationQueryParams, [
      'start',
      'end',
      'statsPeriod',
      'project',
      'environment',
    ]),

    mode: exploreMode,
    visualize: JSON.stringify(pick(locationQueryParams, ['yAxes', 'chartType'])),
    groupBy: fields?.filter(field => !isAggregateFieldOrEquation(field)),
    field: locationQueryParams.field,
    query: locationQueryParams.query,
    sort:
      defined(fields) && defined(locationQueryParams.sort)
        ? _getSort(fields, locationQueryParams.sort as string)
        : undefined,
    interval:
      locationQueryParams.interval ??
      getWidgetInterval(widget.displayType, selection.datetime),
  };

  return `/traces/?${qs.stringify(queryParams)}`;
}

function _getSort(fields: string[], sort: string) {
  const descending = sort.startsWith('-');
  const rawSort = descending ? sort.slice(1) : sort;
  const sortedField = fields?.find(field => getAggregateAlias(field) === rawSort);
  return descending ? `-${sortedField}` : sortedField;
}
