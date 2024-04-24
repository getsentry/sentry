export enum QueryBuilderFocusType {
  FILTER_VALUE = 'filter_value',
  FILTER_OP = 'filter_op',
  FILTER_DELETE = 'filter_delete',
}

interface BaseTokenFocus {
  range: {
    end: number;
    start: number;
  };
  type: QueryBuilderFocusType;
}

interface FilterValueFocus extends BaseTokenFocus {
  editing: boolean;
  type: QueryBuilderFocusType.FILTER_VALUE;
}

interface FilterDeleteFocus extends BaseTokenFocus {
  type: QueryBuilderFocusType.FILTER_DELETE;
}

interface FilterOpFocus extends BaseTokenFocus {
  type: QueryBuilderFocusType.FILTER_OP;
}

export type QueryBuilderFocusState = FilterValueFocus | FilterOpFocus | FilterDeleteFocus;
