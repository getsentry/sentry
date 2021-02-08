import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DynamicSamplingInnerName} from 'app/types/dynamicSampling';
import Field from 'app/views/settings/components/forms/field';
import FieldHelp from 'app/views/settings/components/forms/field/fieldHelp';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextareaField from 'app/views/settings/components/forms/textareaField';

import LegacyBrowsersField from './legacyBrowsersField';

type Condition = {
  category: DynamicSamplingInnerName;
  match: string;
  legacyBrowsers?: Array<string>;
};

type Props = {
  conditions: Array<Condition>;
  categoryOptions: Array<[DynamicSamplingInnerName, string]>;
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
        const showLegacyBrowsers = category === DynamicSamplingInnerName.LEGACY_BROWSERS;
        return (
          <FieldsWrapper key={index}>
            <Fields>
              <SelectField
                label={displayDescription ? t('Category') : undefined}
                help={displayDescription ? t('This is a description') : undefined}
                name={`category-${index}`}
                value={category}
                onChange={value => onChange(index, 'category', value)}
                choices={categoryOptions}
                inline={false}
                hideControlState
                showHelpInTooltip
                required
                stacked
              />
              <StyledField
                label={displayDescription ? t('Match Conditions') : undefined}
                help={displayDescription ? t('This is a description') : undefined}
                inline={false}
                hideControlState
                showHelpInTooltip
                flexibleControlStateSize
                required
                stacked
              >
                <StyledTextareaField
                  placeholder={
                    showLegacyBrowsers
                      ? t('No match condition')
                      : 'ex. 1* or [I3].[0-9].*'
                  }
                  name={`match-${index}`}
                  value={match}
                  onChange={value => onChange(index, 'match', value)}
                  disabled={showLegacyBrowsers}
                  inline={false}
                  autosize
                  hideControlState
                  stacked
                />
                <FieldHelp>{t('Press enter to add a new match condition')}</FieldHelp>
              </StyledField>
              <ButtonDeleteWrapper>
                <Button onClick={onDelete(index)} size="small">
                  {t('Delete Condition')}
                </Button>
              </ButtonDeleteWrapper>
            </Fields>
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
          </FieldsWrapper>
        );
      })}
      <StyledButton icon={<IconAdd isCircled />} onClick={onAdd} size="small">
        {t('Add Condition')}
      </StyledButton>
    </React.Fragment>
  );
}

export default ConditionFields;

const FieldsWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  grid-gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const Fields = styled('div')`
  display: grid;
  align-items: flex-end;
  border: 1px solid ${p => p.theme.gray200};
  padding: ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
`;

const StyledField = styled(Field)`
  padding-bottom: 0;
`;

const StyledTextareaField = styled(TextareaField)`
  padding-bottom: 0;
`;

const StyledButton = styled(Button)`
  margin-bottom: ${space(2)};
`;

const IconDeleteWrapper = styled('div')`
  height: 40px;
  align-items: center;
  margin-bottom: ${space(2)};
  cursor: pointer;
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
  }
`;

const ButtonDeleteWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding-top: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
