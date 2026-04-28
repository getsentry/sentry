import type {ReactNode} from 'react';

import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {FieldDefinition} from 'sentry/utils/fields';

export interface FilterKeySection {
  children: string[];
  label: ReactNode;
  value: string;
}

export enum QueryInterfaceType {
  TEXT = 'text',
  TOKENIZED = 'tokenized',
}

export interface FocusOverride {
  itemKey: string | 'end';
  part?: 'value' | 'key' | 'op';
}

export type FieldDefinitionGetter = (key: string) => FieldDefinition | null;

export interface CallbackSearchState {
  parsedQuery: ParseResult | null;
  queryIsValid: boolean;
}
