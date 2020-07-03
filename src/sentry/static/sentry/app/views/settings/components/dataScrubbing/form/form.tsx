import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'app/styles/space';
import {t} from 'app/locale';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';
import Button from 'app/components/button';
import {IconChevron} from 'app/icons';

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

type State = {
  displayEventId: boolean;
};

class Form extends React.Component<Props<Rule, KeysOfUnion<Rule>>, State> {
  state: State = {displayEventId: !!this.props.eventId?.value};

  handleChange = <K extends KeysOfUnion<Rule>>(field: K) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.props.onChange(field, event.target.value);
  };

  handleToggleEventId = () => {
    this.setState(prevState => ({displayEventId: !prevState.displayEventId}));
  };

  render() {
    const {
      rule,
      onChange,
      errors,
      onValidate,
      onUpdateEventId,
      sourceSuggestions,
      eventId,
    } = this.props;
    const {method, type, source} = rule;
    const {displayEventId} = this.state;

    return (
      <React.Fragment>
        <FieldGroup hasTwoColumns={rule.method === MethodType.REPLACE}>
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
                onChange={this.handleChange('placeholder')}
                value={rule.placeholder}
              />
            </Field>
          )}
        </FieldGroup>
        <FieldGroup hasTwoColumns={rule.type === RuleType.PATTERN}>
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
                onChange={this.handleChange('pattern')}
                value={rule.pattern}
                onBlur={onValidate('pattern')}
              />
            </Field>
          )}
        </FieldGroup>
        {onUpdateEventId && (
          <React.Fragment>
            <ToggleWrapper>
              {displayEventId ? (
                <Toggle priority="link" onClick={this.handleToggleEventId}>
                  {t('Hide Event ID field')}
                  <IconChevron direction="up" size="xs" />
                </Toggle>
              ) : (
                <Toggle priority="link" onClick={this.handleToggleEventId}>
                  {t('Use Event ID for auto-completion')}
                  <IconChevron direction="down" size="xs" />
                </Toggle>
              )}
            </ToggleWrapper>
          </React.Fragment>
        )}
        <SourceGroup isExpanded={displayEventId}>
          {onUpdateEventId && displayEventId && (
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
        </SourceGroup>
      </React.Fragment>
    );
  }
}

export default Form;

const FieldGroup = styled('div')<{hasTwoColumns: boolean}>`
  display: grid;
  margin-bottom: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-gap: ${space(2)};
    ${p => p.hasTwoColumns && `grid-template-columns: 1fr 1fr;`}
    margin-bottom: ${p => (p.hasTwoColumns ? 0 : space(2))};
  }
`;

const SourceGroup = styled('div')<{isExpanded: boolean}>`
  height: 65px;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  transition-property: height;
  ${p =>
    p.isExpanded &&
    `
    border-radius: ${p.theme.borderRadius};
    border: 1px solid ${p.theme.borderDark};
    box-shadow: ${p.theme.dropShadowLight};
    margin: ${space(2)} 0 ${space(3)} 0;
    padding: ${space(2)};
    height: 180px;
  `}
`;

const RegularExpression = styled(Input)`
  font-size: ${p => p.theme.fontSizeSmall};
  input {
    font-family: ${p => p.theme.text.familyMono};
  }
`;

const ToggleWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const Toggle = styled(Button)`
  font-weight: 700;
  color: ${p => p.theme.gray600};
  &:hover,
  &:focus {
    color: ${p => p.theme.gray700};
  }
  > *:first-child {
    display: grid;
    grid-gap: ${space(0.5)};
    grid-template-columns: repeat(2, max-content);
    align-items: center;
  }
`;
