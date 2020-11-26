import {DateTimeObject, getDiffInMinutes, TWO_WEEKS} from 'app/components/charts/utils';
import {t} from 'app/locale';
import {GlobalSelection, NewQuery, Organization} from 'app/types';
import {escapeDoubleQuotes} from 'app/utils';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {formatVersion} from 'app/utils/formatters';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {WEB_VITAL_DETAILS} from 'app/views/performance/transactionVitals/constants';

import {EventType, YAxis} from './releaseChartControls';

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
  eventType?: EventType,
  organization?: Organization,
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
  const toOther = `to_other(release,"${escapeDoubleQuotes(version)}",others,current)`;
  // this orderby ensures that the order is [others, current]
  const toOtherAlias = getAggregateAlias(toOther);

  const baseQuery: Omit<NewQuery, 'query'> = {
    id: undefined,
    version: 2,
    name: `${t('Release')} ${formatVersion(version)}`,
    fields: [`count()`, toOther],
    orderby: toOtherAlias,
    range: period,
    environment: environments,
    projects,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
  };

  switch (yAxis) {
    case YAxis.FAILED_TRANSACTIONS:
      const statusFilters = ['ok', 'cancelled', 'unknown'].map(
        s => `!transaction.status:${s}`
      );
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: stringifyQueryObject(
          new QueryResults(
            ['event.type:transaction', releaseFilter, ...statusFilters].filter(Boolean)
          )
        ),
      });
    case YAxis.COUNT_LCP:
    case YAxis.COUNT_DURATION:
      const column =
        yAxis === YAxis.COUNT_DURATION ? 'transaction.duration' : 'measurements.lcp';
      const threshold =
        yAxis === YAxis.COUNT_DURATION
          ? organization?.apdexThreshold
          : WEB_VITAL_DETAILS[WebVital.LCP].failureThreshold;
      return EventView.fromSavedQuery({
        ...baseQuery,
        query: stringifyQueryObject(
          new QueryResults(
            [
              'event.type:transaction',
              releaseFilter,
              threshold ? `${column}:>${threshold}` : '',
            ].filter(Boolean)
          )
        ),
      });
    case YAxis.EVENTS:
      if (organization?.features?.includes('release-performance-views')) {
        const eventTypeFilter = eventType === 'all' ? '' : `event.type:${eventType}`;
        return EventView.fromSavedQuery({
          ...baseQuery,
          query: stringifyQueryObject(
            new QueryResults([releaseFilter, eventTypeFilter].filter(Boolean))
          ),
        });
      } else {
        // TODO(tonyx): Delete this else once the feature flags are removed
        return EventView.fromSavedQuery({
          ...baseQuery,
          fields: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
          query: stringifyQueryObject(
            new QueryResults([`release:${version}`, '!event.type:transaction'])
          ),
          orderby: '-last_seen',
        });
      }
    default:
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
