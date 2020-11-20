import {TWO_WEEKS, getDiffInMinutes, DateTimeObject} from 'app/components/charts/utils';
import EventView from 'app/utils/discover/eventView';
import {GlobalSelection, NewQuery} from 'app/types';
import {formatVersion} from 'app/utils/formatters';
import {getUtcDateString} from 'app/utils/dates';
import {t} from 'app/locale';
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';
import {WEB_VITAL_DETAILS} from 'app/views/performance/transactionVitals/constants';
import {WebVital} from 'app/utils/discover/fields';

import {YAxis} from './releaseChartControls';

export function getInterval(datetimeObj: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes > TWO_WEEKS) {
    return '6h';
  } else {
    return '1h';
  }
}

export function getReleaseEventView(
  selection: GlobalSelection,
  version: string,
  yAxis?: YAxis,
  organization?: any,
  /**
   * Indicates that we're only interested in the current release.
   * This is useful for the event meta end point where we don't want
   * to include the other releases.
   */
  currentOnly?: boolean
): EventView {
  const {projects, environments, datetime} = selection;
  const {start, end, period} = datetime;
  const releaseFilter = currentOnly ? `release:${version}` : '';

  const baseQuery: Omit<NewQuery, 'query'> = {
    id: undefined,
    version: 2,
    name: `${t('Release')} ${formatVersion(version)}`,
    fields: [`count()`, `to_other(release,${version},others,current)`],
    orderby: `to_other_release_${version}_current_others`,
    range: period,
    environment: environments,
    projects,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
  };

  switch (yAxis) {
    case YAxis.ALL_TRANSACTIONS:
    case YAxis.FAILED_TRANSACTIONS:
      const notStatuses =
        yAxis === YAxis.FAILED_TRANSACTIONS ? ['ok', 'cancelled', 'unknown'] : [];
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: stringifyQueryObject(
          new QueryResults([
            releaseFilter,
            'event.type:transaction',
            ...notStatuses.map(s => `!transaction.status:${s}`),
          ])
        ),
      });
    case YAxis.COUNT_LCP:
    case YAxis.COUNT_DURATION:
      const column =
        yAxis === YAxis.COUNT_DURATION ? 'transaction.duration' : 'measurements.lcp';
      const threshold =
        yAxis === YAxis.COUNT_DURATION
          ? organization.apdexThreshold
          : WEB_VITAL_DETAILS[WebVital.LCP].failureThreshold;
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: stringifyQueryObject(
          new QueryResults([
            releaseFilter,
            'event.type:transaction',
            `${column}:>${threshold}`,
          ])
        ),
      });
    case YAxis.EVENTS:
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: stringifyQueryObject(
          new QueryResults([releaseFilter, '!event.type:transaction'])
        ),
      });
    default:
      // If this was an unknown YAxis, we assume this is for an Open in Discover button
      // for the issues list.
      return EventView.fromSavedQuery({
        ...baseQuery,
        fields: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
        query: stringifyQueryObject(
          new QueryResults([`release:${version}`, '!event.type:transaction'])
        ),
        orderby: '-last_seen',
      });
  }
}
