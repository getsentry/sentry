import {DurationUnit} from 'sentry/utils/discover/fields';

import {TabularData} from '../../common/types';

export const spanSamplesWithDurations: TabularData = {
  meta: {
    fields: {
      'p99(span.duration)': 'duration',
    },
    units: {
      'p99(span.duration)': DurationUnit.MILLISECOND,
    },
  },
  data: [
    {
      id: 'ad1453eb469473f5',
      'p99(span.duration)': 170.63336816976206,
      timestamp: '2024-10-24T16:28:28-04:00',
    },
    {
      id: '8c6aa95b24d15772',
      'p99(span.duration)': 218.91675989347792,
      timestamp: '2024-10-25T05:00:01-04:00',
    },
    {
      id: '8831cccebb865893',
      'p99(span.duration)': 74.50192368733187,
      timestamp: '2024-10-25T13:21:12-04:00',
    },
  ],
};
