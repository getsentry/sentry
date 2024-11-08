import type {ReactNode} from 'react';

import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {FieldDefinition} from 'sentry/utils/fields';

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
  itemKey: string | 'end';
  part?: 'value' | 'key';
};

export type FieldDefinitionGetter = (key: string) => FieldDefinition | null;

export type CallbackSearchState = {
  parsedQuery: ParseResult | null;
  queryIsValid: boolean;
};
