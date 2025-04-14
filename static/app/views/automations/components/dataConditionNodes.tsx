import {Fragment} from 'react';
import styled from '@emotion/styled';

import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import {t, tct} from 'sentry/locale';
import {
  type DataCondition,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';

export type Node = {
  label: string;
  configNode?: (
    condition: Omit<DataCondition, 'condition_group' | 'type' | 'id'>,
    condition_id: string,
    onUpdate: (condition: Record<string, any>) => void
  ) => React.ReactNode;
};

// TODO: split nodes into separate files
export const dataConditionNodesMap: Partial<Record<DataConditionType, Node>> = {
  [DataConditionType.FIRST_SEEN_EVENT]: {
    label: t('A new issue is created'),
  },
  [DataConditionType.REGRESSION_EVENT]: {
    label: t('A resolved issue becomes unresolved'),
  },
  [DataConditionType.REAPPEARED_EVENT]: {
    label: t('An issue escalates'),
  },
  [DataConditionType.AGE_COMPARISON]: {
    label: t('Compare the age of an issue'),
    configNode: (
      condition: Omit<DataCondition, 'condition_group' | 'type' | 'id'>,
      condition_id: string,
      onUpdate: (comparison: Record<string, any>) => void
    ) => (
      <Fragment>
        {tct('The issue is [comparison_type] [value] [time]', {
          comparison_type: (
            <InlineSelectControl
              styles={selectControlStyles}
              name={`${condition_id}.comparison.type`}
              value={condition.comparison.type}
              options={[
                {value: 'older', label: 'older than'},
                {value: 'newer', label: 'newer than'},
              ]}
              onChange={(value: DataConditionType) => {
                onUpdate({
                  type: value,
                });
              }}
            />
          ),
          value: (
            <InlineNumberInput
              name={`${condition_id}.comparison.value`}
              min={0}
              step={1}
              onChange={(value: string) => {
                onUpdate({
                  value: parseInt(value, 10),
                });
              }}
            />
          ),
          time: (
            <InlineSelectControl
              styles={selectControlStyles}
              name={`${condition_id}.comparison.time`}
              value={condition.comparison.time}
              options={[
                {value: 'minutes', label: 'minute(s)'},
                {value: 'hours', label: 'hour(s)'},
                {value: 'days', label: 'day(s)'},
              ]}
              onChange={(value: string) => {
                onUpdate({
                  time: value,
                });
              }}
            />
          ),
        })}
      </Fragment>
    ),
  },
  [DataConditionType.ISSUE_OCCURRENCES]: {
    label: t('Check how many times an issue has occurred'),
    configNode: (
      condition: Omit<DataCondition, 'condition_group' | 'type' | 'id'>,
      condition_id: string,
      onUpdate: (comparison: Record<string, any>) => void
    ) => (
      <Fragment>
        {tct('The issue has happened at least [value] times', {
          value: (
            <InlineNumberInput
              name={`${condition_id}.comparison.value`}
              value={condition.comparison.value}
              min={1}
              step={1}
              onChange={(value: string) => {
                onUpdate({
                  value,
                });
              }}
            />
          ),
        })}
      </Fragment>
    ),
  },
};

const InlineNumberInput = styled(NumberField)`
  padding: 0;
  width: 90px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;

const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '28px',
    height: '28px',
    padding: 0,
  }),
};

const InlineSelectControl = styled(SelectField)`
  width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
`;
