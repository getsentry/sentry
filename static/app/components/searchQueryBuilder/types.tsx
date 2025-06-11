import type {ReactNode} from 'react';

import type {ParseResult, TermOperator} from 'sentry/components/searchSyntax/parser';
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

/**
 * This is a list of wildcard operators that are used in the search query builder.
 * These are only present on the frontend. This is because we utilize the underlying
 * '*' character rather than introducing new operators on the backend.
 */
export enum WildcardOperators {
  CONTAINS = 'contains',
  DOES_NOT_CONTAIN = 'does not contain',
  STARTS_WITH = 'starts with',
  ENDS_WITH = 'ends with',
}

export function isWildcardOperator(
  op: SearchQueryBuilderOperators
): op is WildcardOperators {
  return typeof op === 'string' && Object.values(WildcardOperators).includes(op as any);
}

export type SearchQueryBuilderOperators = TermOperator | WildcardOperators;
