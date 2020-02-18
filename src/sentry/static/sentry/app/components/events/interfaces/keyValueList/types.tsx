import {Meta} from 'app/types';

export type KeyValueListData = {
  key: string;
  subject: React.ReactNode;
  value: React.ReactNode | null;
  meta: Meta;
  subjectDataTestId?: string;
  subjectIcon?: React.ReactNode;
};
