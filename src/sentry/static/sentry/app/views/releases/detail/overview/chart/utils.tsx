import {TWO_WEEKS, getDiffInMinutes, DateTimeObject} from 'app/components/charts/utils';
import EventView from 'app/utils/discover/eventView';
import {GlobalSelection} from 'app/types';
import {formatVersion} from 'app/utils/formatters';
import {getUtcDateString} from 'app/utils/dates';
import {t} from 'app/locale';
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';

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
  /**
   * Indicates that we're only interested in the current release.
   * This is useful for the event meta end point where we don't want
   * to include the other releases.
   */
  currentOnly?: boolean
): EventView {
  const {projects, environments, datetime} = selection;
  const {start, end, period} = datetime;

  switch (yAxis) {
    case YAxis.ALL_TRANSACTIONS:
    case YAxis.FAILED_TRANSACTIONS:
      const statusFilter =
        yAxis === YAxis.FAILED_TRANSACTIONS
          ? ['ok', 'cancelled', 'unknown'].map(s => `!transaction.status:${s}`).join(' ')
          : '';
      const releaseFilter = currentOnly ? `release:${version}` : '';
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
