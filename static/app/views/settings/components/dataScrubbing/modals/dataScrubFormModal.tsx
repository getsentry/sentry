import {Fragment, useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import submitRules from 'sentry/views/settings/components/dataScrubbing/submitRules';
import type {
  AttributeResults,
  EditableRule,
  Rule,
  SourceSuggestion,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  AllowedDataScrubbingDatasets,
  MethodType,
  RuleType,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  areScrubbingDatasetsEnabled,
  getDatasetLabelLong,
  getMethodLabel,
  getRuleLabel,
  TraceItemFieldSelector,
  validateTraceItemFieldSelector,
} from 'sentry/views/settings/components/dataScrubbing/utils';

import AttributeField from './form/attributeField';
import EventIdField from './form/eventIdField';
import SourceField from './form/sourceField';
import handleError, {ErrorType} from './handleError';
import {hasCaptureGroups, useSourceGroupData} from './utils';

const dataScrubSchema = z
  .object({
    method: z.enum(MethodType),
    pattern: z.string(),
    placeholder: z.string(),
    replaceCaptured: z.boolean(),
    source: z.string(),
    type: z.enum(RuleType),
    dataset: z.enum(AllowedDataScrubbingDatasets),
  })
  .superRefine((data, ctx) => {
    if (data.type === RuleType.PATTERN && !data.pattern.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: t('Field Required'),
        path: ['pattern'],
      });
    }
    if (!data.source.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: t('Field Required'),
        path: ['source'],
      });
    }
  });

export type DataScrubFormModalProps = ModalRenderProps & {
  api: Client;
  attributeResults: AttributeResults;
  endpoint: string;
  onGetNewRules: (values: EditableRule) => Rule[];
  onSubmitSuccess: (data: {relayPiiConfig: string}) => void;
  orgSlug: string;
  savedRules: Rule[];
  title: string;
  initialState?: Partial<EditableRule>;
  projectId?: Project['id'];
};

function DataScrubFormModal({
  api,
  attributeResults: _attributeResults,
  endpoint,
  onGetNewRules,
  onSubmitSuccess,
  orgSlug,
  title,
  initialState,
  projectId,
  closeModal,
  Header,
  Body,
  Footer,
}: DataScrubFormModalProps) {
  const organization = useOrganization();
  const traceItemDatasetsEnabled = areScrubbingDatasetsEnabled(organization);
  const {sourceGroupData} = useSourceGroupData();

  // Compute initial dataset from initialState
  const initialValues = {
    type: initialState?.type ?? RuleType.CREDITCARD,
    method: initialState?.method ?? MethodType.MASK,
    source: initialState?.source ?? '',
    placeholder: initialState?.placeholder ?? '',
    pattern: initialState?.pattern ?? '',
    replaceCaptured: initialState?.replaceCaptured ?? false,
  };

  const tempRule = {...initialValues, id: 0} as Rule;
  const traceItemFieldSelector = TraceItemFieldSelector.fromRule(tempRule);
  const initialDataset =
    traceItemFieldSelector?.getDataset() ?? AllowedDataScrubbingDatasets.DEFAULT;

  const [dataset, setDataset] = useState<AllowedDataScrubbingDatasets>(initialDataset);
  const [sourceSuggestions, setSourceSuggestions] = useState<SourceSuggestion[]>(
    sourceGroupData.sourceSuggestions
  );
  const [displayEventId, setDisplayEventId] = useState(!!sourceGroupData.eventId);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      ...initialValues,
      dataset: initialDataset,
    },
    validators: {
      onSubmit: dataScrubSchema,
    },
    onSubmit: async ({value}) => {
      // Strip dataset from values before creating rules
      const {dataset: _dataset, ...ruleValues} = value;
      const newRules = onGetNewRules(ruleValues as EditableRule);

      try {
        const data = await submitRules(api, endpoint, newRules);
        onSubmitSuccess(data);
        closeModal();
      } catch (error: any) {
        const parsedError = handleError(error);
        switch (parsedError.type) {
          case ErrorType.INVALID_SELECTOR:
          case ErrorType.ATTRIBUTE_INVALID:
            setFieldErrors(form, {
              source: {message: parsedError.message},
            });
            break;
          case ErrorType.REGEX_PARSE:
            setFieldErrors(form, {
              pattern: {message: parsedError.message},
            });
            break;
          default:
            addErrorMessage(parsedError.message);
        }
      }
    },
  });

  const handleValidateAttributeField = useCallback(
    (value: string) => {
      const traceItemField = TraceItemFieldSelector.fromField(dataset, value);

      if (!traceItemField) {
        return;
      }

      const validation = validateTraceItemFieldSelector(traceItemField);
      if (!validation.isValid && validation.error) {
        setFieldErrors(form, {
          source: {message: validation.error},
        });
      }
    },
    [dataset, form]
  );

  const containsRootDeepWildcard = (source: string) => {
    return /(^|[^.])\*\*$/.test(source);
  };

  const methodOptions = sortBy(Object.values(MethodType)).map(value => ({
    ...getMethodLabel(value),
    value,
    details: getMethodLabel(value).description
      ? `(${getMethodLabel(value).description})`
      : undefined,
  }));

  const typeOptions = sortBy(Object.values(RuleType)).map(value => ({
    label: getRuleLabel(value),
    value,
  }));

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <h5>{title}</h5>
      </Header>
      <Body>
        <Stack gap={{xs: 'md', sm: 'xl'}}>
          {traceItemDatasetsEnabled && (
            <form.AppField name="dataset">
              {field => (
                <field.Radio.Group
                  value={field.state.value}
                  onChange={value => {
                    field.handleChange(value as AllowedDataScrubbingDatasets);
                    setDataset(value as AllowedDataScrubbingDatasets);
                    form.setFieldValue('source', '');
                  }}
                >
                  <field.Layout.Stack
                    label={t('Dataset')}
                    hintText={t('The dataset targetted by the scrubbing rule')}
                    variant="compact"
                  >
                    <Flex gap="lg">
                      {sortBy(Object.values(AllowedDataScrubbingDatasets)).map(value => (
                        <field.Radio.Item key={value} value={value}>
                          {getDatasetLabelLong(value)}
                        </field.Radio.Item>
                      ))}
                    </Flex>
                  </field.Layout.Stack>
                </field.Radio.Group>
              )}
            </form.AppField>
          )}

          <form.AppField
            name="method"
            listeners={{
              onChange: ({value}) => {
                if (value !== MethodType.REPLACE) {
                  form.setFieldValue('placeholder', '');
                }
              },
            }}
          >
            {field => (
              <form.AppField name="placeholder">
                {placeholderField => (
                  <Grid
                    columns={
                      field.state.value === MethodType.REPLACE
                        ? {xs: '1fr', sm: '1fr 1fr'}
                        : '1fr'
                    }
                    gap={{sm: 'md'}}
                  >
                    <field.Layout.Stack
                      label={t('Method')}
                      hintText={t('What to do')}
                      variant="compact"
                    >
                      <field.Select
                        placeholder={t('Select method')}
                        options={methodOptions}
                        value={field.state.value}
                        onChange={field.handleChange}
                        isSearchable={false}
                        openOnFocus
                      />
                    </field.Layout.Stack>
                    {field.state.value === MethodType.REPLACE && (
                      <placeholderField.Layout.Stack
                        label={t('Custom Placeholder (Optional)')}
                        hintText={t('It will replace the default placeholder [Filtered]')}
                        variant="compact"
                      >
                        <placeholderField.Input
                          type="text"
                          placeholder={`[${t('Filtered')}]`}
                          onChange={placeholderField.handleChange}
                          value={placeholderField.state.value}
                        />
                      </placeholderField.Layout.Stack>
                    )}
                  </Grid>
                )}
              </form.AppField>
            )}
          </form.AppField>

          <form.AppField
            name="type"
            listeners={{
              onChange: ({value}) => {
                if (value !== RuleType.PATTERN) {
                  form.setFieldValue('pattern', '');
                  form.setFieldValue('replaceCaptured', false);
                }
              },
            }}
          >
            {typeField => (
              <form.AppField name="pattern">
                {patternField => (
                  <form.AppField name="replaceCaptured">
                    {replaceCapturedField => (
                      <Grid
                        columns={
                          typeField.state.value === RuleType.PATTERN
                            ? {xs: '1fr', sm: '1fr 1fr'}
                            : '1fr'
                        }
                        gap={{sm: 'md'}}
                      >
                        <typeField.Layout.Stack
                          label={t('Data Type')}
                          hintText={t(
                            'What to look for. Use an existing pattern or define your own using regular expressions.'
                          )}
                          variant="compact"
                        >
                          <typeField.Select
                            placeholder={t('Select type')}
                            options={typeOptions}
                            value={typeField.state.value}
                            onChange={typeField.handleChange}
                            isSearchable={false}
                            openOnFocus
                          />
                        </typeField.Layout.Stack>
                        {typeField.state.value === RuleType.PATTERN && (
                          <patternField.Layout.Stack
                            label={t('Regex matches')}
                            hintText={t('Custom regular expression (see documentation)')}
                            variant="compact"
                            required
                          >
                            <RegularExpressionWrapper>
                              <patternField.Input
                                type="text"
                                placeholder={t('[a-zA-Z0-9]+')}
                                onChange={patternField.handleChange}
                                value={patternField.state.value}
                              />
                            </RegularExpressionWrapper>
                            <ReplaceCapturedCheckbox
                              pattern={patternField.state.value}
                              checked={replaceCapturedField.state.value}
                              onChange={val => replaceCapturedField.handleChange(val)}
                            />
                          </patternField.Layout.Stack>
                        )}
                      </Grid>
                    )}
                  </form.AppField>
                )}
              </form.AppField>
            )}
          </form.AppField>

          <form.AppField name="source">
            {sourceField => {
              const sourceValue = sourceField.state.value;
              const sourceError = sourceField.state.meta.errors?.[0]?.message;

              if (traceItemDatasetsEnabled) {
                return (
                  <SourceGroup>
                    {dataset === AllowedDataScrubbingDatasets.DEFAULT ? (
                      <Fragment>
                        <Flex justify="end">
                          {displayEventId ? (
                            <Toggle
                              priority="link"
                              onClick={() => setDisplayEventId(false)}
                            >
                              {t('Hide event ID field')}
                              <IconChevron direction="up" size="xs" />
                            </Toggle>
                          ) : (
                            <Toggle
                              priority="link"
                              onClick={() => setDisplayEventId(true)}
                            >
                              {t('Use event ID for auto-completion')}
                              <IconChevron direction="down" size="xs" />
                            </Toggle>
                          )}
                        </Flex>
                        <SourceGroup isExpanded={displayEventId}>
                          {displayEventId && (
                            <EventIdField
                              orgSlug={orgSlug}
                              projectId={projectId}
                              onSuggestionsLoaded={setSourceSuggestions}
                            />
                          )}
                          <sourceField.Layout.Stack
                            label={t('Source')}
                            hintText={t(
                              'Where to look. In the simplest case this can be an attribute name.'
                            )}
                            variant="compact"
                            required
                          >
                            <SourceField
                              onChange={value => sourceField.handleChange(value)}
                              value={sourceValue}
                              onBlur={sourceField.handleBlur}
                              isRegExMatchesSelected={
                                form.getFieldValue('type') === RuleType.PATTERN
                              }
                              suggestions={sourceSuggestions}
                            />
                          </sourceField.Layout.Stack>
                          {containsRootDeepWildcard(sourceValue) && (
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
                            sourceField.handleChange(
                              TraceItemFieldSelector.fromField(
                                dataset,
                                value
                              )?.getSelector() ?? ''
                            )
                          }
                          value={sourceValue}
                          error={sourceError}
                          onBlur={(value, _event) => {
                            handleValidateAttributeField(value);
                            sourceField.handleBlur();
                          }}
                          projectId={projectId}
                        />
                      </Fragment>
                    )}
                  </SourceGroup>
                );
              }

              return (
                <Fragment>
                  <Flex justify="end">
                    {displayEventId ? (
                      <Toggle priority="link" onClick={() => setDisplayEventId(false)}>
                        {t('Hide event ID field')}
                        <IconChevron direction="up" size="xs" />
                      </Toggle>
                    ) : (
                      <Toggle priority="link" onClick={() => setDisplayEventId(true)}>
                        {t('Use event ID for auto-completion')}
                        <IconChevron direction="down" size="xs" />
                      </Toggle>
                    )}
                  </Flex>
                  <SourceGroup isExpanded={displayEventId}>
                    {displayEventId && (
                      <EventIdField
                        orgSlug={orgSlug}
                        projectId={projectId}
                        onSuggestionsLoaded={setSourceSuggestions}
                      />
                    )}
                    <sourceField.Layout.Stack
                      label={t('Source')}
                      hintText={t(
                        'Where to look. In the simplest case this can be an attribute name.'
                      )}
                      variant="compact"
                      required
                    >
                      <SourceField
                        onChange={value => sourceField.handleChange(value)}
                        value={sourceValue}
                        onBlur={sourceField.handleBlur}
                        isRegExMatchesSelected={
                          form.getFieldValue('type') === RuleType.PATTERN
                        }
                        suggestions={sourceSuggestions}
                      />
                    </sourceField.Layout.Stack>
                  </SourceGroup>
                </Fragment>
              );
            }}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="lg">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button type="submit" priority="primary" form={form.formId}>
            {t('Save Rule')}
          </Button>
        </Grid>
      </Footer>
    </form.AppForm>
  );
}

function ReplaceCapturedCheckbox({
  pattern,
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  pattern: string;
}) {
  const disabled = !hasCaptureGroups(pattern);
  return (
    <Tooltip
      title={disabled ? t('This rule does not contain capture groups') : undefined}
      disabled={!disabled}
    >
      <Flex gap="xs" align="center">
        <Checkbox
          id="replace-captured"
          name="replaceCaptured"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
        />
        <ReplaceCapturedLabel htmlFor="replace-captured" disabled={disabled}>
          {t('Only replace first capture match')}
        </ReplaceCapturedLabel>
      </Flex>
    </Tooltip>
  );
}

export default DataScrubFormModal;

const SourceGroup = styled('div')<{isExpanded?: boolean}>`
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  transition-property: height;
  ${p =>
    p.isExpanded &&
    css`
      border-radius: ${p.theme.radius.md};
      border: 1px solid ${p.theme.tokens.border.primary};
      box-shadow: ${p.theme.dropShadowMedium};
      margin: ${space(2)} 0 ${space(3)} 0;
      padding: ${space(2)};
    `}
`;

const RegularExpressionWrapper = styled('div')`
  input {
    font-family: ${p => p.theme.font.family.mono};
  }
  margin-bottom: ${p => p.theme.space.md};
`;

const Toggle = styled(Button)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
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
      color: ${p.theme.tokens.content.disabled};
    `}
`;
