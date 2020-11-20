import {DateTimeObject, getDiffInMinutes, TWO_WEEKS} from 'app/components/charts/utils';
import {t} from 'app/locale';
import {GlobalSelection} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import {formatVersion} from 'app/utils/formatters';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import {WEB_VITAL_DETAILS} from 'app/views/performance/transactionVitals/constants';

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

  switch (yAxis) {
    case YAxis.ALL_TRANSACTIONS:
    case YAxis.FAILED_TRANSACTIONS:
      const statusFilter =
        yAxis === YAxis.FAILED_TRANSACTIONS
          ? ['ok', 'cancelled', 'unknown'].map(s => `!transaction.status:${s}`).join(' ')
          : '';
      return EventView.fromSavedQuery({
        id: undefined,
        version: 2,
        name: `${t('Release')} ${formatVersion(version)}`,
        fields: [`count()`, `to_other(release,${version},others,current)`],
        query: `${releaseFilter} ${statusFilter}`.trim(),
        // this orderby ensures that the order is [others, current]
        orderby: `to_other_release_${version}_current_others`,
        range: period,
        environment: environments,
        projects,
        start: start ? getUtcDateString(start) : undefined,
        end: end ? getUtcDateString(end) : undefined,
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
        id: undefined,
        version: 2,
        name: `${t('Release')} ${formatVersion(version)}`,
        fields: ['count()', `to_other(release,${version},others,current)`],
        query: `event.type:transaction ${releaseFilter} ${column}:>${threshold}`,
        // this orderby ensures that the order is [others, current]
        orderby: `to_other_release_${version}_current_others`,
        range: period,
        environment: environments,
        projects,
        start: start ? getUtcDateString(start) : undefined,
        end: end ? getUtcDateString(end) : undefined,
      });
    default:
      return EventView.fromSavedQuery({
        id: undefined,
        version: 2,
        name: `${t('Release')} ${formatVersion(version)}`,
        fields: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
        query: stringifyQueryObject(
          new QueryResults([`release:${version}`, '!event.type:transaction'])
        ),
        orderby: '-last_seen',
        range: period,
        environment: environments,
        projects,
        start: start ? getUtcDateString(start) : undefined,
        end: end ? getUtcDateString(end) : undefined,
      });
  }
}
