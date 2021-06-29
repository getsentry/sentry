import {SessionApiResponse, SessionField} from 'app/types';
import {defined, percent} from 'app/utils';
import {getCrashFreePercent} from 'app/views/releases/utils';

export function getCount(groups: SessionApiResponse['groups'] = [], field: SessionField) {
  return groups.reduce((acc, group) => acc + group.totals[field], 0);
}

export function getCrashCount(
  groups: SessionApiResponse['groups'] = [],
  field: SessionField
) {
  return getCount(
    groups.filter(({by}) => by['session.status'] === 'crashed'),
    field
  );
}

export function getCrashFreeRate(
  groups: SessionApiResponse['groups'] = [],
  field: SessionField
) {
  const totalCount = groups.reduce((acc, group) => acc + group.totals[field], 0);

  const crashedCount = getCrashCount(groups, field);

  return !defined(totalCount) || totalCount === 0
    ? null
    : getCrashFreePercent(100 - percent(crashedCount ?? 0, totalCount ?? 0));
}
