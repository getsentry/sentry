import type {ReactNode} from 'react';

// eslint-disable-next-line @sentry/scraps/restrict-types-file -- type-only import from a runtime module; extracting a type leaf would cascade to its many importers
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
// eslint-disable-next-line @sentry/scraps/restrict-types-file -- type-only import from a runtime module; extracting a type leaf would cascade to its many importers
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
  part?: 'value' | 'key' | 'op';
};

export type FieldDefinitionGetter = (key: string) => FieldDefinition | null;

export type CallbackSearchState = {
  parsedQuery: ParseResult | null;
  queryIsValid: boolean;
};
