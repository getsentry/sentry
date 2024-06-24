import type {ReactNode} from 'react';

import type {Tag} from 'sentry/types/group';

export type FilterKeySection = {
  children: Tag[];
  label: ReactNode;
  value: string;
};

export enum QueryInterfaceType {
  TEXT = 'text',
  TOKENIZED = 'tokenized',
}

export type FocusOverride = {
  itemKey: string;
  part?: 'value';
};
