import moment from 'moment-timezone';

import type {DiscoverSeries} from './types';

const DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ';

export function convertDiscoverTimeseriesResponse(data: any[]): DiscoverSeries['data'] {
  return data.map(([timestamp, [{count: value}]]) => {
    return {
      name: moment(parseInt(timestamp, 10) * 1000).format(DATE_FORMAT),
      value,
    };
  });
}
