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

export enum ExtendedTermOperators {
  DEFAULT = '',
  GREATER_THAN_EQUAL = '>=',
  LESS_THAN_EQUAL = '<=',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  EQUAL = '=',
  NOT_EQUAL = '!=',
  CONTAINS = 'contains',
  DOES_NOT_CONTAIN = 'does not contain',
  STARTS_WITH = 'starts with',
  ENDS_WITH = 'ends with',
}
