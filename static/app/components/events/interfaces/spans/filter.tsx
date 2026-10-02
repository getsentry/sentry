type NoFilter = {
  type: 'no_filter';
};

type ActiveFilter = {
  operationNames: Set<string>;
  type: 'active_filter';
};

export type ActiveOperationFilter = NoFilter | ActiveFilter;
