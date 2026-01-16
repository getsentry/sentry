import type {ReactNode} from 'react';

import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {FieldDefinition, FieldKind} from 'sentry/utils/fields';
import type {FieldDefinitionType} from 'sentry/utils/fields/hooks';

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

export type FieldDefinitionGetter = (
  key: string,
  type?: FieldDefinitionType,
  kind?: FieldKind
) => FieldDefinition | null;

export type CallbackSearchState = {
  parsedQuery: ParseResult | null;
  queryIsValid: boolean;
};
