
export enum QueryBuilderFocusType {
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
  | TokenValueFocus
  | TokenOpFocus
  | TokenDeleteFocus;
