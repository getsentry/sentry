import {Meta} from 'app/types';

export type KeyValueListData = {
  key: string;
  subject?: React.ReactNode;
  value: string | null;
  meta?: Meta;
};
