import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';

import EventIdField from './eventIdField';
import FormField from './formField';
import SelectField from './selectField';
import SourceField from './sourceField';
import {getRuleLabel, getMethodLabel} from '../utils';
import {
  MethodType,
  RuleType,
  Rule,
  SourceSuggestion,
  EventId,
  Errors,
  KeysOfUnion,
} from '../types';

type Props<R extends Rule, K extends KeysOfUnion<R>> = {
  rule: R;
  onChange: (stateProperty: K, value: R[K]) => void;
  onValidate: (field: K) => () => void;
  onUpdateEventId?: (eventId: string) => void;
  errors: Errors;
  sourceSuggestions?: Array<SourceSuggestion>;
  eventId?: EventId;
};

const Form = ({
  rule,
  errors,
  sourceSuggestions,
  onUpdateEventId,
  eventId,
  onChange,
  onValidate,
}: Props<Rule, KeysOfUnion<Rule>>) => {
  const {source, type, method} = rule;
  return (
    <Wrapper>
      <GroupField hasTwoColumns={rule.method === MethodType.REPLACE}>
        <FormField label={t('Method')} tooltipInfo={t('What to do')}>
          <SelectField
            placeholder={t('Select method')}
            name="method"
            options={sortBy(Object.values(MethodType)).map(value => ({
              ...getMethodLabel(value),
              value,
            }))}
            value={method}
            onChange={({value}) => onChange('method', value)}
          />
        </FormField>
        {rule.method === MethodType.REPLACE && (
          <FormField
            label={t('Custom Placeholder (Optional)')}
            tooltipInfo={t('It will replace the default placeholder [Filtered]')}
          >
            <StyledTextField
              name="placeholder"
              placeholder={`[${t('Filtered')}]`}
              onChange={(value: string) => {
                onChange('placeholder', value);
              }}
              value={rule.placeholder}
            />
          </FormField>
        )}
      </GroupField>
      <GroupField hasTwoColumns={rule.type === RuleType.PATTERN}>
        <FormField
          label={t('Data Type')}
          tooltipInfo={t(
            'What to look for. Use an existing pattern or define your own using regular expressions.'
          )}
        >
          <SelectField
            placeholder={t('Select type')}
            name="type"
            options={sortBy(Object.values(RuleType)).map(value => ({
              label: getRuleLabel(value),
              value,
            }))}
            value={type}
            onChange={({value}) => onChange('type', value)}
          />
        </FormField>
        {rule.type === RuleType.PATTERN && (
          <FormField
            label={t('Regex matches')}
            tooltipInfo={t('Custom Perl-style regex (PCRE)')}
          >
            <RegularExpression
              name="pattern"
              placeholder={t('[a-zA-Z0-9]+')}
              onChange={(value: string) => {
                onChange('pattern', value);
              }}
              value={rule.pattern}
              onBlur={onValidate('pattern')}
              error={errors?.pattern}
            />
          </FormField>
        )}
      </GroupField>
      {onUpdateEventId && (
        <EventIdField onUpdateEventId={onUpdateEventId} eventId={eventId} />
      )}
      <FormField
        label={t('Source')}
        tooltipInfo={t(
          'Where to look. In the simplest case this can be an attribute name.'
        )}
      >
        <SourceField
          onChange={(value: string) => {
            onChange('source', value);
          }}
          value={source}
          onBlur={onValidate('source')}
          isRegExMatchesSelected={type === RuleType.PATTERN}
          suggestions={sourceSuggestions}
          error={errors?.source}
        />
      </FormField>
    </Wrapper>
  );
};

export default Form;

const Wrapper = styled('div')`
  display: grid;
  grid-row-gap: ${space(2)};
`;

const GroupField = styled('div')<{hasTwoColumns: boolean}>`
  display: grid;
  grid-gap: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    ${p => p.hasTwoColumns && `grid-template-columns: 1fr 1fr;`}
  }
`;

const StyledTextField = styled(TextField)<{error?: string}>`
  height: 40px;
  input {
    height: 40px;
  }
  ${p => !p.error && `margin-bottom: 0;`}
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    margin-bottom: 0;
  }
`;

const RegularExpression = styled(StyledTextField)`
  font-size: ${p => p.theme.fontSizeSmall};
  input {
    font-family: ${p => p.theme.text.familyMono};
  }
`;
