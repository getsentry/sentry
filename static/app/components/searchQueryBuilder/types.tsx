import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';

export type SearchTokenValue = {
  text: string;
  type: string;
};

export type SearchToken = TokenResult<Token.FILTER> & {
  id: string;
};

export type QueryBuilderToken = {
  id: string;
  key?: string;
  operator?: string;
  value?: string | string[];
};

export interface QueryBuilderTokenWithKey extends QueryBuilderToken {
  key: string;
  operator: string;
}

export type QueryBuilderPart = 'key' | 'op' | 'value' | 'delete';

export type QueryBuilderFocusState = {
  editing: boolean;
  part: QueryBuilderPart | null;
  tokenId: string;
  valueIndex?: number;
};
