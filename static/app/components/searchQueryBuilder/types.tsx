import type {ReactNode} from 'react';

import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {FieldDefinition, FieldKind} from 'sentry/utils/fields';

export type FilterKeySection = {children: string[]; label: ReactNode; value: string};

export enum QueryInterfaceType {
  TEXT = 'text',
  TOKENIZED = 'tokenized',
}

export type FocusOverride = {itemKey: string | 'end'; part?: 'value' | 'key' | 'op'};

export type FieldDefinitionGetter = (
  key: string,
  options?: {
    /**
     * Raw argument texts of the aggregate being resolved. Lets a getter choose
     * between signatures of the same function, such as Discover-style and
     * filter-first `count_if`.
     */
    aggregateArgs?: readonly string[];
    kind?: FieldKind;
  }
) => FieldDefinition | null;

export type CallbackSearchState = {
  parsedQuery: ParseResult | null;
  queryIsValid: boolean;
};
