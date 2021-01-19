import {canIncludePreviousPeriod} from 'app/components/charts/utils';
import {GlobalSelection} from 'app/types';

export function shouldFetchPreviousPeriod(datetime: GlobalSelection['datetime']) {
  const {start, end, period} = datetime;

  return !start && !end && canIncludePreviousPeriod(true, period);
}
