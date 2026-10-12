import {createContext, useContext} from 'react';

import type {
  DataCondition,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

interface DataConditionNodeProps {
  condition: DataCondition;
  condition_id: string;
  onUpdate: (params: {comparison?: any; type?: DataConditionType}) => void;
}

export const DataConditionNodeContext = createContext<DataConditionNodeProps | null>(
  null
);

export function useDataConditionNodeContext(): DataConditionNodeProps {
  const context = useContext(DataConditionNodeContext);
  if (!context) {
    throw new Error(
      'useDataConditionNodeContext was called outside of DataConditionNode'
    );
  }
  return context;
}
