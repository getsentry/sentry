import {createContext, useContext} from 'react';
import styled from '@emotion/styled';

import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import {t} from 'sentry/locale';
import {
  DataConditionType,
  type NewDataCondition,
} from 'sentry/types/workflowEngine/dataConditions';
import AgeComparisonNode from 'sentry/views/automations/components/actionFilters/ageComparison';
import IssueOccurrencesNode from 'sentry/views/automations/components/actionFilters/issueOccurrences';

interface DataConditionNodeProps {
  condition: NewDataCondition;
  condition_id: string;
  onUpdate: (condition: Record<string, any>) => void;
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

type DataConditionNode = {
  label: string;
  dataCondition?: React.ReactNode;
};

export const dataConditionNodesMap = new Map<DataConditionType, DataConditionNode>([
  [
    DataConditionType.FIRST_SEEN_EVENT,
    {
      label: t('A new issue is created'),
    },
  ],
  [
    DataConditionType.REGRESSION_EVENT,
    {
      label: t('A resolved issue becomes unresolved'),
    },
  ],
  [
    DataConditionType.REAPPEARED_EVENT,
    {
      label: t('An issue escalates'),
    },
  ],
  [
    DataConditionType.AGE_COMPARISON,
    {
      label: t('Compare the age of an issue'),
      dataCondition: <AgeComparisonNode />,
    },
  ],
  [
    DataConditionType.ISSUE_OCCURRENCES,
    {
      label: t('Issue frequency'),
      dataCondition: <IssueOccurrencesNode />,
    },
  ],
]);

export const InlineNumberInput = styled(NumberField)`
  padding: 0;
  width: 90px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;

export const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '28px',
    height: '28px',
    padding: 0,
  }),
};

export const InlineSelectControl = styled(SelectField)`
  width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
`;
