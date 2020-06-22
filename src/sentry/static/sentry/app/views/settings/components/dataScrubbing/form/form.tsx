import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';
import Field from 'app/views/settings/components/forms/field';

import EventIdField from './eventIdField';
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
    <React.Fragment>
      <GroupField hasTwoColumns={rule.method === MethodType.REPLACE}>
        <Field
          label={t('Method')}
          description={t('What to do')}
          inline={false}
          flexibleControlStateSize
          stacked
        >
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
        </Field>
        {rule.method === MethodType.REPLACE && (
          <Field
            label={t('Custom Placeholder (Optional)')}
            description={t('It will replace the default placeholder [Filtered]')}
            inline={false}
            flexibleControlStateSize
            stacked
          >
            <StyledTextField
              name="placeholder"
              placeholder={`[${t('Filtered')}]`}
              onChange={(value: string) => {
                onChange('placeholder', value);
              }}
              value={rule.placeholder}
            />
          </Field>
        )}
      </GroupField>
      <GroupField hasTwoColumns={rule.type === RuleType.PATTERN}>
        <Field
          label={t('Data Type')}
          description={t(
            'What to look for. Use an existing pattern or define your own using regular expressions.'
          )}
          inline={false}
          flexibleControlStateSize
          stacked
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
        </Field>
        {rule.type === RuleType.PATTERN && (
          <Field
            label={t('Regex matches')}
            description={t('Custom Perl-style regex (PCRE)')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
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
          </Field>
        )}
      </GroupField>
      {onUpdateEventId && (
        <EventIdField onUpdateEventId={onUpdateEventId} eventId={eventId} />
      )}
      <Field
        label={t('Source')}
        description={t(
          'Where to look. In the simplest case this can be an attribute name.'
        )}
        inline={false}
        flexibleControlStateSize
        stacked
        required
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
      </Field>
    </React.Fragment>
  );
};

export default Form;

const GroupField = styled('div')<{hasTwoColumns: boolean}>`
  display: grid;
  margin-bottom: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-gap: ${space(2)};
    ${p => p.hasTwoColumns && `grid-template-columns: 1fr 1fr;`}
    margin-bottom: ${p => (p.hasTwoColumns ? 0 : space(2))};
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
