import trimStart from 'lodash/trimStart';

import type {EventsStatsOptions} from 'sentry/actionCreators/events';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {
  getAggregateAlias,
  getEquationAliasIndex,
  isEquation,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets, TOP_N} from 'sentry/utils/discover/types';
import {DisplayType, type Widget} from 'sentry/views/dashboards/types';
import {getNumEquations, getWidgetInterval} from 'sentry/views/dashboards/utils';

/**
 * This function is used to generate the request data for timeseries widgets
 * and is intended to be used eventually by doEventsRequest
 */
export function getSeriesRequestData(
  widget: Widget,
  queryIndex: number,
  organization: Organization,
  pageFilters: PageFilters,
  dataset: DiscoverDatasets,
  referrer?: string,
  widgetInterval?: string
): EventsStatsOptions<true> {
  const widgetQuery = widget.queries[queryIndex]!;
  const {displayType, limit} = widget;
  const {environments, projects} = pageFilters;
  const {start, end, period: statsPeriod} = pageFilters.datetime;
  const interval =
    widgetInterval ?? getWidgetInterval(widget, {start, end, period: statsPeriod}, '1m');

  let requestData: EventsStatsOptions<true>;
  if (displayType === DisplayType.TOP_N) {
    requestData = {
      organization,
      interval,
      start,
      end,
      project: projects,
      environment: environments,
      period: statsPeriod,
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates[widgetQuery.aggregates.length - 1],
      includePrevious: false,
      referrer,
      partial: true,
      field: [...widgetQuery.columns, ...widgetQuery.aggregates],
      includeAllArgs: true,
      topEvents: TOP_N,
      dataset,
    };
    if (widgetQuery.orderby) {
      requestData.orderby = widgetQuery.orderby;
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
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates,
      orderby: widgetQuery.orderby,
      includePrevious: false,
      referrer,
      partial: true,
      includeAllArgs: true,
      dataset,
    };
    if (widgetQuery.columns?.length !== 0) {
      requestData.topEvents = limit ?? TOP_N;
      requestData.field = [...widgetQuery.columns, ...widgetQuery.aggregates];

      // Compare field and orderby as aliases to ensure requestData has
      // the orderby selected
      // If the orderby is an equation alias, do not inject it
      const orderby = trimStart(widgetQuery.orderby, '-');
      if (
        widgetQuery.orderby &&
        !isEquationAlias(orderby) &&
        !requestData.field.map(getAggregateAlias).includes(getAggregateAlias(orderby))
      ) {
        requestData.field.push(orderby);
      }

      // The "Other" series is only included when there is one
      // y-axis and one widgetQuery
      requestData.excludeOther =
        widgetQuery.aggregates.length !== 1 || widget.queries.length !== 1;

      if ([DiscoverDatasets.OURLOGS, DiscoverDatasets.SPANS].includes(dataset)) {
        if (
          isEquation(trimStart(widgetQuery.orderby, '-')) &&
          !requestData.field?.includes(trimStart(widgetQuery.orderby, '-'))
        ) {
          requestData.field = [
            ...widgetQuery.columns,
            ...widgetQuery.aggregates,
            trimStart(widgetQuery.orderby, '-'),
          ];
        } else if (isEquationAlias(trimStart(widgetQuery.orderby, '-'))) {
          const equations = widgetQuery.fields?.filter(isEquation) ?? [];
          const equationIndex = getEquationAliasIndex(
            trimStart(widgetQuery.orderby, '-')
          );

          const equationOrderBy = equations[equationIndex];
          if (equationOrderBy) {
            requestData.orderby = widgetQuery.orderby.startsWith('-')
              ? `-${equationOrderBy}`
              : equationOrderBy;
          }
        }
      } else {
        if (isEquation(trimStart(widgetQuery.orderby, '-'))) {
          const nextEquationIndex = getNumEquations(widgetQuery.aggregates);
          const isDescending = widgetQuery.orderby.startsWith('-');
          const prefix = isDescending ? '-' : '';

          // Construct the alias form of the equation and inject it into the request
          requestData.orderby = `${prefix}equation[${nextEquationIndex}]`;
          requestData.field = [
            ...widgetQuery.columns,
            ...widgetQuery.aggregates,
            trimStart(widgetQuery.orderby, '-'),
          ];
        }
      }
    }
  }

  return requestData;
}
