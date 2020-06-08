import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';

import {
  Rule,
  RuleType,
  MethodType,
  KeysOfUnion,
  EventId,
  SourceSuggestion,
  Errors,
} from './types';
import {getMethodLabel, getRuleLabel} from './utils';
import SourceField from './sourceField';
import FormField from './formField';
import SelectField from './selectField';
import EventIdField from './eventIdField';

type Props<R extends Rule, K extends KeysOfUnion<R>> = {
  rule: R;
  onChange: (stateProperty: K, value: R[K]) => void;
  onValidate: (field: K) => () => void;
  onUpdateEventId?: (eventId: string) => void;
  errors: Errors;
  sourceSuggestions?: Array<SourceSuggestion>;
  eventId?: EventId;
  disabled?: boolean;
};

const Form = ({
  disabled,
  rule,
  errors,
  sourceSuggestions,
  onUpdateEventId,
  eventId,
  onChange,
  onValidate,
}: Props<Rule, KeysOfUnion<Rule>>) => {
  const {method, type, source} = rule;
  return (
    <Wrapper>
      <WrapperSelectFields>
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
            isDisabled={disabled}
          />
        </FormField>
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
            isDisabled={disabled}
          />
        </FormField>
      </WrapperSelectFields>
      {rule.type === RuleType.PATTERN && (
        <FormField
          label={t('Regex matches')}
          tooltipInfo={t('Custom Perl-style regex (PCRE)')}
          isFullWidth
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
            disabled={disabled}
          />
        </FormField>
      )}
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
          disabled={disabled}
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

const WrapperSelectFields = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: 1fr;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: auto auto;
  }
`;

const RegularExpression = styled(TextField)`
  font-size: ${p => p.theme.fontSizeSmall};
  height: 40px;
  input {
    height: 40px;
    font-family: ${p => p.theme.text.familyMono};
  }
`;
