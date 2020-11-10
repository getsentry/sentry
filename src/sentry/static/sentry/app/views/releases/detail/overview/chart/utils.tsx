import {getDiffInMinutes, DateTimeObject} from 'app/components/charts/utils';
import EventView from 'app/utils/discover/eventView';
import {GlobalSelection} from 'app/types';
import {formatVersion} from 'app/utils/formatters';
import {getUtcDateString} from 'app/utils/dates';
import {t} from 'app/locale';
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';

import {YAxis} from './releaseChartControls';

// In minutes
const FOURTEEN_DAYS = 20160;

export function getInterval(datetimeObj: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes > FOURTEEN_DAYS) {
    return '6h';
  } else {
    return '1h';
  }
}

export function getReleaseEventView(
  selection: GlobalSelection,
  version: string,
  yAxis?: YAxis
): EventView {
  const {projects, environments, datetime} = selection;
  const {start, end, period} = datetime;

  if (yAxis === YAxis.FAILURE_RATE) {
    return EventView.fromSavedQuery({
      id: undefined,
      version: 2,
      name: `${t('Release')} ${formatVersion(version)}`,
      fields: ['failure_rate()', `to_other(release,${version})`],
      query: '',
      orderby: '-failure_rate',
      range: period,
      environment: environments,
      projects,
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    });
  }

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
