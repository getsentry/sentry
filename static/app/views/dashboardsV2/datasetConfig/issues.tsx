import {Group} from 'sentry/types';
import {TableData} from 'sentry/utils/discover/discoverQuery';

import {DatasetConfig} from './base';

export const IssuesConfig: DatasetConfig<never, Group[]> = {
  transformTable: (_data: Group[]) => {
    return {data: []} as TableData;
  },
};
