import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';

import {Rule, RuleType, MethodType} from '../types';
import {getMethodTypeLabel, getRuleTypeLabel} from './utils';
import Source from './sourceField';
import FormField from './formField';
import SelectField from './selectField';
import EventidField from './eventIdField';

type EventIdProps = React.ComponentProps<typeof EventidField>;
type SourceProps = React.ComponentProps<typeof Source>;
type Errors = {
  customRegularExpression?: string;
  source?: string;
};

type Props = EventIdProps & {
  rule: Rule;
  sourceSuggestions: SourceProps['suggestions'];
  onChange: <T extends keyof Omit<Rule, 'id'>>(stateProperty: T, value: Rule[T]) => void;
  onUpdateEventId: (eventId: string) => void;
  onValidate: <T extends keyof Errors>(field: T) => () => void;
  errors: Errors;
};

const Form = ({
  disabled,
  rule: {source, customRegularExpression, type, method},
  errors,
  sourceSuggestions,
  onUpdateEventId,
  eventId,
  onChange,
  onValidate,
}: Props) => (
  <Wrapper>
    <WrapperSelectFields>
      <FormField label={t('Method')} tooltipInfo={t('What to do')}>
        <SelectField
          placeholder={t('Select method')}
          name="method"
          options={sortBy(Object.values(MethodType)).map(value => ({
            ...getMethodTypeLabel(value),
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
            label: getRuleTypeLabel(value),
            value,
          }))}
          value={type}
          onChange={({value}) => onChange('type', value)}
          isDisabled={disabled}
        />
      </FormField>
    </WrapperSelectFields>
    {type === RuleType.PATTERN && (
      <FormField
        label={t('Regex matches')}
        tooltipInfo={t('Custom Perl-style regex (PCRE)')}
        isFullWidth
      >
        <CustomRegularExpression
          name="customRegularExpression"
          placeholder={t('[a-zA-Z0-9]+')}
          onChange={(value: string) => {
            onChange('customRegularExpression', value);
          }}
          value={customRegularExpression}
          onBlur={onValidate('customRegularExpression')}
          error={errors.customRegularExpression}
          disabled={disabled}
        />
      </FormField>
    )}
    <EventidField onUpdateEventId={onUpdateEventId} eventId={eventId} />
    <FormField
      label={t('Source')}
      tooltipInfo={t(
        'Where to look. In the simplest case this can be an attribute name.'
      )}
    >
      <Source
        onChange={(value: string) => {
          onChange('source', value);
        }}
        isRegExMatchesSelected={type === RuleType.PATTERN}
        value={source}
        onBlur={onValidate('source')}
        suggestions={sourceSuggestions}
        error={errors.source}
        disabled={disabled}
      />
    </FormField>
  </Wrapper>
);

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

const CustomRegularExpression = styled(TextField)`
  font-size: ${p => p.theme.fontSizeSmall};
  height: 40px;
  input {
    height: 40px;
    font-family: ${p => p.theme.text.familyMono};
  }
`;
