import {Location} from 'history';

import {canIncludePreviousPeriod} from 'sentry/components/charts/utils';
import {GlobalSelection} from 'sentry/types';

export function shouldFetchPreviousPeriod(
  datetime: Partial<GlobalSelection['datetime']>
) {
  const {start, end, period} = datetime;

  return !start && !end && canIncludePreviousPeriod(true, period);
}

export function didProjectOrEnvironmentChange(location1: Location, location2: Location) {
  return (
    location1.query.environment !== location2.query.environment ||
    location1.query.project !== location2.query.project
  );
}
