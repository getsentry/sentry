import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
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

  const handleChange = <K extends KeysOfUnion<Rule>>(field: K) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(field, event.target.value);
  };

  return (
    <React.Fragment>
      <GroupField hasTwoColumns={rule.method === MethodType.REPLACE}>
        <Field
          label={t('Method')}
          help={t('What to do')}
          inline={false}
          flexibleControlStateSize
          stacked
          showHelpInTooltip
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
            help={t('It will replace the default placeholder [Filtered]')}
            inline={false}
            flexibleControlStateSize
            stacked
            showHelpInTooltip
          >
            <Input
              type="text"
              name="placeholder"
              placeholder={`[${t('Filtered')}]`}
              onChange={handleChange('placeholder')}
              value={rule.placeholder}
            />
          </Field>
        )}
      </GroupField>
      <GroupField hasTwoColumns={rule.type === RuleType.PATTERN}>
        <Field
          label={t('Data Type')}
          help={t(
            'What to look for. Use an existing pattern or define your own using regular expressions.'
          )}
          inline={false}
          flexibleControlStateSize
          stacked
          showHelpInTooltip
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
            help={t('Custom Perl-style regex (PCRE)')}
            inline={false}
            error={errors?.pattern}
            flexibleControlStateSize
            stacked
            required
            showHelpInTooltip
          >
            <RegularExpression
              type="text"
              name="pattern"
              placeholder={t('[a-zA-Z0-9]+')}
              onChange={handleChange('pattern')}
              value={rule.pattern}
              onBlur={onValidate('pattern')}
            />
          </Field>
        )}
      </GroupField>
      {onUpdateEventId && (
        <EventIdField onUpdateEventId={onUpdateEventId} eventId={eventId} />
      )}
      <Field
        label={t('Source')}
        help={t('Where to look. In the simplest case this can be an attribute name.')}
        inline={false}
        error={errors?.source}
        flexibleControlStateSize
        stacked
        required
        showHelpInTooltip
      >
        <SourceField
          onChange={value => onChange('source', value)}
          value={source}
          onBlur={onValidate('source')}
          isRegExMatchesSelected={type === RuleType.PATTERN}
          suggestions={sourceSuggestions}
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

const RegularExpression = styled(Input)`
  font-size: ${p => p.theme.fontSizeSmall};
  input {
    font-family: ${p => p.theme.text.familyMono};
  }
`;
