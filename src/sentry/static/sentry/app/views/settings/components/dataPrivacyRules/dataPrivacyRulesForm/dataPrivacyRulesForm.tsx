import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import TextField from 'app/components/forms/textField';

import {getRuleTypeLabel, getMethodTypeLabel} from './utils';
import {RuleType, MethodType} from './types';
import DataPrivacyRulesFormSource from './dataPrivacyRulesFormSource';
import DataPrivacyRulesFormField from './dataPrivacyRulesFormField';
import DataPrivacyRulesFormSelectControl from './dataPrivacyRulesFormSelectControl';
import DataPrivacyRulesFormEventId from './dataPrivacyRulesFormEventId';

type Rule = {
  id: number;
  type: RuleType;
  method: MethodType;
  source: string;
  customRegularExpression?: string;
};

type EventIdProps = React.ComponentProps<typeof DataPrivacyRulesFormEventId>;
type SourceProps = React.ComponentProps<typeof DataPrivacyRulesFormSource>;
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

const DataPrivacyRulesForm = ({
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
      <DataPrivacyRulesFormField label={t('Method')} tooltipInfo={t('What to do')}>
        <DataPrivacyRulesFormSelectControl
          placeholder={t('Select method')}
          name="method"
          options={sortBy(Object.values(MethodType)).map(value => ({
            label: getMethodTypeLabel(value),
            value,
          }))}
          value={method}
          onChange={({value}) => onChange('method', value)}
          isDisabled={disabled}
        />
      </DataPrivacyRulesFormField>
      <DataPrivacyRulesFormField
        label={t('Data Type')}
        tooltipInfo={t(
          'What to look for. Use an existing pattern or define your own using regular expressions.'
        )}
      >
        <DataPrivacyRulesFormSelectControl
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
      </DataPrivacyRulesFormField>
    </WrapperSelectFields>
    {type === RuleType.PATTERN && (
      <DataPrivacyRulesFormField
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
      </DataPrivacyRulesFormField>
    )}
    <DataPrivacyRulesFormEventId onUpdateEventId={onUpdateEventId} eventId={eventId} />
    <DataPrivacyRulesFormField
      label={t('Source')}
      tooltipInfo={t(
        'Where to look. In the simplest case this can be an attribute name.'
      )}
    >
      <DataPrivacyRulesFormSource
        onChange={(value: string) => {
          onChange('source', value);
        }}
        value={source}
        onBlur={onValidate('source')}
        suggestions={sourceSuggestions}
        error={errors.source}
        disabled={disabled}
      />
    </DataPrivacyRulesFormField>
  </Wrapper>
);

export default DataPrivacyRulesForm;

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
