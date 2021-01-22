import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DynamicSamplingConditionOperator} from 'app/types/dynamicSampling';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';

type Condition = {
  category:
    | DynamicSamplingConditionOperator.GLOB_MATCH
    | DynamicSamplingConditionOperator.STR_EQUAL_NO_CASE
    | DynamicSamplingConditionOperator.EQUAL;
  match: string;
};

const categoryChoices = [
  [DynamicSamplingConditionOperator.GLOB_MATCH, t('Releases')],
  [DynamicSamplingConditionOperator.STR_EQUAL_NO_CASE, t('Enviroments')],
  [DynamicSamplingConditionOperator.EQUAL, t('Users')],
];

type Props = {
  conditions: Array<Condition>;
  onAdd: () => void;
  onDelete: (index: number) => () => void;
  onChange: <T extends keyof Condition>(
    index: number,
    field: T,
    value: Condition[T]
  ) => void;
};

function Condition({conditions, onAdd, onDelete, onChange}: Props) {
  return (
    <React.Fragment>
      {conditions.map(({match, category}, index) => (
        <Fields key={index}>
          <SelectField
            label={t('Category')}
            help="this is a description"
            name="category"
            choices={categoryChoices}
            onChange={value => onChange(index, 'category', value)}
            value={category}
            inline={false}
            hideControlState
            showHelpInTooltip
            required
            stacked
          />
          <TextField
            label={t('Match Conditions')}
            help="this is a description"
            placeholder="ex. 1* or [I3].[0-9].*"
            name="match"
            inline={false}
            value={match}
            onChange={value => onChange(index, 'match', value)}
            hideControlState
            showHelpInTooltip
            required
            stacked
          />
          <IconDeleteWrapper onClick={onDelete(index)}>
            <IconDelete aria-label={t('Delete Condition')} />
          </IconDeleteWrapper>
        </Fields>
      ))}
      <StyledButton icon={<IconAdd isCircled />} onClick={onAdd}>
        {t('Add Condition')}
      </StyledButton>
    </React.Fragment>
  );
}

export default Condition;

const Fields = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr max-content;
  grid-gap: ${space(2)};
  align-items: flex-end;
`;

const StyledButton = styled(Button)`
  margin-bottom: ${space(2)};
`;

const IconDeleteWrapper = styled('div')`
  height: 40px;
  display: flex;
  align-items: center;
  margin-bottom: ${space(2)};
  cursor: pointer;
`;
