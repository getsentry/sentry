import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';

<<<<<<< HEAD:src/sentry/static/sentry/app/views/settings/components/dataScrubbing/form/form.tsx
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
=======
import EventIdField from './eventIdField';
import FormField from './formField';
import SelectField from './selectField';
import SourceField from './sourceField';
import {getRuleLabel, getMethodLabel} from '../utils';
import {MethodType, RuleType, Rule, SourceSuggestion, EventId, Errors} from '../types';

type Props = {
>>>>>>> ref(pii): Updated save logic:src/sentry/static/sentry/app/views/settings/components/dataPrivacyRules/form/form.tsx
  rule: Rule;
  onChange: <T extends keyof Omit<Rule, 'id'>>(stateProperty: T, value: Rule[T]) => void;
  onValidate: <T extends keyof Omit<Rule, 'id'>>(field: T) => () => void;
  onUpdateEventId?: (eventId: string) => void;
  sourceSuggestions?: Array<SourceSuggestion>;
  eventId?: EventId;
  disabled?: boolean;
  errors?: Errors;
};

const Form = ({
  disabled,
  rule: {source, customRegex, type, method},
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
    {type === RuleType.PATTERN && (
      <FormField
        label={t('Regex matches')}
        tooltipInfo={t('Custom Perl-style regex (PCRE)')}
        isFullWidth
      >
        <RegularExpression
          name="customRegex"
          placeholder={t('[a-zA-Z0-9]+')}
          onChange={(value: string) => {
            onChange('customRegex', value);
          }}
          value={customRegex}
          onBlur={onValidate('customRegex')}
          error={errors?.customRegex}
          disabled={disabled}
        />
      </FormField>
<<<<<<< HEAD:src/sentry/static/sentry/app/views/settings/components/dataScrubbing/form/form.tsx
    )}
    <EventidField onUpdateEventId={onUpdateEventId} eventId={eventId} />
=======
    )}
    {onUpdateEventId && (
      <EventIdField onUpdateEventId={onUpdateEventId} eventId={eventId} />
    )}
>>>>>>> ref(pii): Updated save logic:src/sentry/static/sentry/app/views/settings/components/dataPrivacyRules/form/form.tsx
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
