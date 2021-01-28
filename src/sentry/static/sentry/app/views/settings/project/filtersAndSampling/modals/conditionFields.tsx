import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';

import LegacyBrowsersField from './legacyBrowsersField';
import {Category} from './utils';

type Condition = {
  category: Category;
  match: string;
  legacyBrowsers?: Array<string>;
};

type Props = {
  conditions: Array<Condition>;
  categoryOptions: Array<[string, string]>;
  onAdd: () => void;
  onDelete: (index: number) => () => void;
  onChange: <T extends keyof Condition>(
    index: number,
    field: T,
    value: Condition[T]
  ) => void;
};

function ConditionFields({
  conditions,
  categoryOptions,
  onAdd,
  onDelete,
  onChange,
}: Props) {
  return (
    <React.Fragment>
      {conditions.map(({match, category}, index) => {
        const displayDescription = index === 0;
        const showLegacyBrowsers = category === Category.LEGACY_BROWSERS;
        return (
          <Fields key={index}>
            <SelectField
              label={displayDescription ? t('Category') : undefined}
              help={displayDescription ? t('This is a description') : undefined}
              name="category"
              value={category}
              onChange={value => onChange(index, 'category', value)}
              choices={categoryOptions}
              inline={false}
              hideControlState
              showHelpInTooltip
              required
              stacked
            />
            <TextField
              label={displayDescription ? t('Match Conditions') : undefined}
              help={displayDescription ? t('This is a description') : undefined}
              placeholder={
                showLegacyBrowsers ? t('No match condition') : 'ex. 1* or [I3].[0-9].*'
              }
              name="match"
              value={match}
              onChange={value => onChange(index, 'match', value)}
              disabled={showLegacyBrowsers}
              inline={false}
              hideControlState
              showHelpInTooltip
              required
              stacked
            />
            <IconDeleteWrapper onClick={onDelete(index)}>
              <IconDelete aria-label={t('Delete Condition')} />
            </IconDeleteWrapper>
            {showLegacyBrowsers && (
              <LegacyBrowsersField
                onChange={value => {
                  onChange(index, 'legacyBrowsers', value);
                }}
              />
            )}
          </Fields>
        );
      })}
      <StyledButton icon={<IconAdd isCircled />} onClick={onAdd} size="small">
        {t('Add Condition')}
      </StyledButton>
    </React.Fragment>
  );
}

export default ConditionFields;

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
