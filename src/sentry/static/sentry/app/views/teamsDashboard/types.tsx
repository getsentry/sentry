import {CardData} from './teamDetails/feed/types';

export type LocalStorageDashboardType = {
  [teamName: string]:
    | undefined
    | {
        cards?: Array<CardData>;
        environments?: Array<string>;
      };
};
