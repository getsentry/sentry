type NoFilter = {
  type: 'no_filter';
};

export type ActiveFilter = {
  operationNames: Set<string>;
  type: 'active_filter';
};

export const noFilter: NoFilter = {
  type: 'no_filter',
};

export type ActiveOperationFilter = NoFilter | ActiveFilter;

export function toggleFilter(
  previousState: ActiveOperationFilter,
  operationName: string
): ActiveOperationFilter {
  if (previousState.type === 'no_filter') {
    return {
      type: 'active_filter',
      operationNames: new Set([operationName]),
    };
  }

  // invariant: previousState.type === 'active_filter'
  // invariant: previousState.operationNames.size >= 1

  const {operationNames} = previousState;

  if (operationNames.has(operationName)) {
    operationNames.delete(operationName);
  } else {
    operationNames.add(operationName);
  }

  if (operationNames.size > 0) {
    return {
      type: 'active_filter',
      operationNames,
    };
  }

  return {
    type: 'no_filter',
  };
}

export function toggleAllFilters(
  previousState: ActiveOperationFilter,
  operationNames: string[]
): ActiveOperationFilter {
  if (previousState.type === 'no_filter') {
    return {
      type: 'active_filter',
      operationNames: new Set(operationNames),
    };
  }

  // invariant: previousState.type === 'active_filter'

  if (previousState.operationNames.size === operationNames.length) {
    // all filters were selected, so the next state should un-select all filters
    return {
      type: 'no_filter',
    };
  }

  // not all filters were selected, so the next state is to select all the remaining filters
  return {
    type: 'active_filter',
    operationNames: new Set(operationNames),
  };
}
