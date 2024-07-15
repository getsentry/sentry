import type {ReactNode} from 'react';

export type FilterKeySection = {
  children: string[];
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
