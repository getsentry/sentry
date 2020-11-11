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
  secondary?: boolean
): EventView {
  const {projects, environments, datetime} = selection;
  const {start, end, period} = datetime;

  switch (yAxis) {
    case YAxis.FAILURE_COUNT:
      // the secondary query should only differ by the query string
      const goodStatuses = ['ok', 'cancelled', 'unknown'];
      const query = secondary
        ? goodStatuses.map(s => `!transaction.status:${s}`).join(' ')
        : goodStatuses.map(s => `transaction.status:${s}`).join(' OR ');
      return EventView.fromSavedQuery({
        id: undefined,
        version: 2,
        name: `${t('Release')} ${formatVersion(version)}`,
        fields: [`count()`, `to_other(release,${version})`],
        query,
        orderby: '-count',
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
