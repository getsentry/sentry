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

export enum QueryBuilderFocusType {
  FULL_TOKEN = 'full_token',
  TOKEN_KEY = 'token_key',
  TOKEN_VALUE = 'token_value',
  TOKEN_OP = 'token_op',
  TOKEN_DELETE = 'token_delete',
}

interface BaseTokenFocus {
  range: {
    end: number;
    start: number;
  };
  type: QueryBuilderFocusType;
}

interface FullTokenFocus extends BaseTokenFocus {
  type: QueryBuilderFocusType.FULL_TOKEN;
}

interface TokenKeyFocus extends BaseTokenFocus {
  editing: boolean;
  type: QueryBuilderFocusType.TOKEN_KEY;
}

interface TokenValueFocus extends BaseTokenFocus {
  editing: boolean;
  type: QueryBuilderFocusType.TOKEN_VALUE;
}

interface TokenDeleteFocus extends BaseTokenFocus {
  type: QueryBuilderFocusType.TOKEN_DELETE;
}

interface TokenOpFocus extends BaseTokenFocus {
  type: QueryBuilderFocusType.TOKEN_OP;
}

export type QueryBuilderFocusState =
  | FullTokenFocus
  | TokenKeyFocus
  | TokenValueFocus
  | TokenOpFocus
  | TokenDeleteFocus;
