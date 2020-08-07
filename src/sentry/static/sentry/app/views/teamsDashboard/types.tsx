import {CardData} from './teamDetails/feed/types';

export type LocalStorageDashboardType = Record<
  string,
  | undefined
  | {
      cards?: Array<CardData>;
      environments?: Array<string>;
    }
>;
