import {Location} from 'history';

import {canIncludePreviousPeriod} from 'app/components/charts/utils';
import {GlobalSelection} from 'app/types';

export function shouldFetchPreviousPeriod(datetime: GlobalSelection['datetime']) {
  const {start, end, period} = datetime;

  return !start && !end && canIncludePreviousPeriod(true, period);
}

export function didProjectOrEnvironmentChange(location1: Location, location2: Location) {
  return (
    location1.query.environment !== location2.query.environment ||
    location1.query.project !== location2.query.project
  );
}
