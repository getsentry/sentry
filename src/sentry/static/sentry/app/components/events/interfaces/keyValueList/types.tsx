import {Meta} from 'app/types';

export type KeyValueListData = {
  key: string;
  subject: string;
  value?: React.ReactNode;
  meta?: Meta;
};
