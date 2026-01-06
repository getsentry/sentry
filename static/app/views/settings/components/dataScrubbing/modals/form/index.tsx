import {Component, Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Input} from 'sentry/components/core/input';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import RadioField from 'sentry/components/forms/fields/radioField';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import withOrganization from 'sentry/utils/withOrganization';
import {hasCaptureGroups} from 'sentry/views/settings/components/dataScrubbing/modals/utils';
import {
  AllowedDataScrubbingDatasets,
  MethodType,
  RuleType,
  type AttributeResults,
  type EditableRule,
  type EventId,
  type KeysOfUnion,
  type SourceSuggestion,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  areScrubbingDatasetsEnabled,
  getDatasetLabelLong,
  getMethodLabel,
  getRuleLabel,
  TraceItemFieldSelector,
  validateTraceItemFieldSelector,
} from 'sentry/views/settings/components/dataScrubbing/utils';

import AttributeField from './attributeField';
import EventIdField from './eventIdField';
import SelectField from './selectField';
import SourceField from './sourceField';

type Values = EditableRule;

type Props<V extends Values, K extends keyof V> = {
  attributeResults: AttributeResults;
  dataset: AllowedDataScrubbingDatasets;
  errors: Partial<V>;
  eventId: EventId;
  onAttributeError: (message: string) => void;
  onChange: (field: K, value: V[K]) => void;
  onChangeDataset: (dataset: AllowedDataScrubbingDatasets) => void;
  onUpdateEventId: (eventId: string) => void;
  onValidate: (field: K) => () => void;
  organization: Organization;
  sourceSuggestions: SourceSuggestion[];
  values: V;
  projectId?: Project['id'];
};

type State = {
  displayEventId: boolean;
};

function ReplaceCapturedCheckbox({
  values,
  onChange,
}: {
  onChange: (field: 'replaceCaptured', value: boolean) => void;
  values: Values;
}) {
  const disabled = !hasCaptureGroups(values.pattern);
  return (
    <Tooltip
      title={disabled ? t('This rule does not contain capture groups') : undefined}
      disabled={!disabled}
    >
      <Flex gap="xs" align="center">
        <Checkbox
          id="replace-captured"
          name="replaceCaptured"
          checked={values.replaceCaptured}
          disabled={disabled}
          onChange={e => onChange('replaceCaptured', e.target.checked)}
        />
        <ReplaceCapturedLabel htmlFor="replace-captured" disabled={disabled}>
          {t('Only replace first capture match')}
        </ReplaceCapturedLabel>
      </Flex>
    </Tooltip>
  );
}

class Form extends Component<Props<Values, KeysOfUnion<Values>>, State> {
  state: State = {
    displayEventId: !!this.props.eventId?.value,
  };

  handleChange =
    <K extends keyof Values>(field: K) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      this.props.onChange(field, event.target.value as Values[K]);
    };

  handleToggleEventId = () => {
    this.setState(prevState => ({displayEventId: !prevState.displayEventId}));
  };

  handleValidateAttributeField = (value: string) => {
    // Value here is the event.target.value, which is the text of the attribute.
    const traceItemField = TraceItemFieldSelector.fromField(this.props.dataset, value);

    if (!traceItemField) {
      return;
    }

    const validation = validateTraceItemFieldSelector(traceItemField);
    if (!validation.isValid && validation.error) {
      this.props.onAttributeError(validation.error);
    }
  };

  containsRootDeepWildcard = (source: string) => {
    // A root level deep wildcard is '**' not preceded by a period (eg. `**` is root level, vs `$attachments.**`)
    return /(^|[^.])\*\*$/.test(source);
  };

  renderWithDatasets() {
    const {
      values,
      onChange,
      errors,
      onValidate,
      sourceSuggestions,
      onUpdateEventId,
      eventId,
      dataset,
      projectId,
      onChangeDataset,
    } = this.props;
    const {method, type, source} = values;
    const {displayEventId} = this.state;
    const containsRootDeepWildcard = this.containsRootDeepWildcard(source);

    return (
      <Fragment>
        <FieldGroup
          label={t('Dataset')}
          help={t('The dataset targetted by the scrubbing rule')}
          inline={false}
          flexibleControlStateSize
          stacked
          showHelpInTooltip
        >
          <DatasetRadioField
            name="dataset"
            choices={sortBy(Object.values(AllowedDataScrubbingDatasets)).map(value => [
              value,
              getDatasetLabelLong(value),
            ])}
            value={dataset}
            onChange={value => {
              onChangeDataset(value);
              onChange('source', '');
            }}
          />
        </FieldGroup>
        <FieldContainer hasTwoColumns={values.method === MethodType.REPLACE}>
          <FieldGroup
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
              onChange={value => onChange('method', value?.value)}
            />
          </FieldGroup>
          {values.method === MethodType.REPLACE && (
            <FieldGroup
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
                value={values.placeholder}
              />
            </FieldGroup>
          )}
        </FieldContainer>
        <FieldContainer hasTwoColumns={values.type === RuleType.PATTERN}>
          <FieldGroup
            data-test-id="type-field"
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
              onChange={value => onChange('type', value?.value)}
            />
          </FieldGroup>
          {values.type === RuleType.PATTERN && (
            <FieldGroup
              label={t('Regex matches')}
              help={t('Custom regular expression (see documentation)')}
              inline={false}
              id="regex-matches"
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
                value={values.pattern}
                onBlur={onValidate('pattern')}
                id="regex-matches"
              />
              <ReplaceCapturedCheckbox values={values} onChange={onChange} />
            </FieldGroup>
          )}
        </FieldContainer>
        <SourceGroup>
          {dataset === AllowedDataScrubbingDatasets.DEFAULT ? (
            <Fragment>
              <Flex justify="end">
                {displayEventId ? (
                  <Toggle priority="link" onClick={this.handleToggleEventId}>
                    {t('Hide event ID field')}
                    <IconChevron direction="up" size="xs" />
                  </Toggle>
                ) : (
                  <Toggle priority="link" onClick={this.handleToggleEventId}>
                    {t('Use event ID for auto-completion')}
                    <IconChevron direction="down" size="xs" />
                  </Toggle>
                )}
              </Flex>
              <SourceGroup isExpanded={displayEventId}>
                {displayEventId && (
                  <EventIdField onUpdateEventId={onUpdateEventId} eventId={eventId} />
                )}
                <SourceField
                  onChange={value => onChange('source', value)}
                  value={source}
                  error={errors?.source}
                  onBlur={onValidate('source')}
                  isRegExMatchesSelected={type === RuleType.PATTERN}
                  suggestions={sourceSuggestions}
                />
                {containsRootDeepWildcard && (
                  <Alert variant="warning" style={{marginTop: space(1)}}>
                    {t(
                      `Deep wildcards ('**') apply to all datasets unless negated (eg. ** || !$logs.**)`
                    )}
                  </Alert>
                )}
              </SourceGroup>
            </Fragment>
          ) : (
            <Fragment>
              <AttributeField
                dataset={dataset}
                onChange={value =>
                  onChange(
                    'source',
                    TraceItemFieldSelector.fromField(dataset, value)?.getSelector() ?? ''
                  )
                }
                value={source}
                error={errors?.source}
                onBlur={(value, _event) => {
                  this.handleValidateAttributeField(value);
                  onValidate('source')();
                }}
                projectId={projectId}
              />
            </Fragment>
          )}
        </SourceGroup>
      </Fragment>
    );
  }

  render() {
    const {
      values,
      onChange,
      errors,
      onValidate,
      sourceSuggestions,
      onUpdateEventId,
      eventId,
    } = this.props;
    const {method, type, source} = values;
    const {displayEventId} = this.state;
    const traceItemDatasetsEnabled = areScrubbingDatasetsEnabled(this.props.organization);
    if (traceItemDatasetsEnabled) {
      return this.renderWithDatasets();
    }

    return (
      <Fragment>
        <FieldContainer hasTwoColumns={values.method === MethodType.REPLACE}>
          <FieldGroup
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
              onChange={value => onChange('method', value?.value)}
            />
          </FieldGroup>
          {values.method === MethodType.REPLACE && (
            <FieldGroup
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
                value={values.placeholder}
              />
            </FieldGroup>
          )}
        </FieldContainer>
        <FieldContainer hasTwoColumns={values.type === RuleType.PATTERN}>
          <FieldGroup
            data-test-id="type-field"
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
              onChange={value => onChange('type', value?.value)}
            />
          </FieldGroup>
          {values.type === RuleType.PATTERN && (
            <FieldGroup
              label={t('Regex matches')}
              help={t('Custom regular expression (see documentation)')}
              inline={false}
              id="regex-matches"
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
                value={values.pattern}
                onBlur={onValidate('pattern')}
                id="regex-matches"
              />
              <ReplaceCapturedCheckbox values={values} onChange={onChange} />
            </FieldGroup>
          )}
        </FieldContainer>
        <Flex justify="end">
          {displayEventId ? (
            <Toggle priority="link" onClick={this.handleToggleEventId}>
              {t('Hide event ID field')}
              <IconChevron direction="up" size="xs" />
            </Toggle>
          ) : (
            <Toggle priority="link" onClick={this.handleToggleEventId}>
              {t('Use event ID for auto-completion')}
              <IconChevron direction="down" size="xs" />
            </Toggle>
          )}
        </Flex>
        <SourceGroup isExpanded={displayEventId}>
          {displayEventId && (
            <EventIdField onUpdateEventId={onUpdateEventId} eventId={eventId} />
          )}
          <SourceField
            onChange={value => onChange('source', value)}
            value={source}
            error={errors?.source}
            onBlur={onValidate('source')}
            isRegExMatchesSelected={type === RuleType.PATTERN}
            suggestions={sourceSuggestions}
          />
        </SourceGroup>
      </Fragment>
    );
  }
}

export default withOrganization(Form);

const FieldContainer = styled('div')<{hasTwoColumns: boolean}>`
  display: grid;
  margin-bottom: ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    gap: ${space(2)};
    ${p => p.hasTwoColumns && `grid-template-columns: 1fr 1fr;`}
    margin-bottom: ${p => p.theme.space.xl};
  }
`;

const SourceGroup = styled('div')<{isExpanded?: boolean}>`
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  transition-property: height;
  ${p =>
    p.isExpanded &&
    css`
      border-radius: ${p.theme.radius.md};
      border: 1px solid ${p.theme.border};
      box-shadow: ${p.theme.dropShadowMedium};
      margin: ${space(2)} 0 ${space(3)} 0;
      padding: ${space(2)};
    `}
`;

const RegularExpression = styled(Input)`
  font-family: ${p => p.theme.text.familyMono};
  margin-bottom: ${p => p.theme.space.md};
`;

const DatasetRadioField = styled(RadioField)`
  padding: 0px;
  #dataset {
    flex-direction: row;
  }
`;

const Toggle = styled(Button)`
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.subText};
  &:hover,
  &:focus {
    color: ${p => p.theme.tokens.content.primary};
  }
  > *:first-child {
    display: grid;
    gap: ${space(0.5)};
    grid-template-columns: repeat(2, max-content);
    align-items: center;
  }
`;

const ReplaceCapturedLabel = styled('label')<{disabled: boolean}>`
  font-weight: normal;
  margin-bottom: 0;
  line-height: 1rem;
  ${p =>
    p.disabled &&
    css`
      color: ${p.theme.disabled};
    `}
`;
