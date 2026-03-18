import {Fragment, useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
  useStore,
} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {submitRules} from 'sentry/views/settings/components/dataScrubbing/submitRules';
import type {
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

import {AttributeField} from './form/attributeField';
import {EventIdField} from './form/eventIdField';
import SourceField from './form/sourceField';
import {ErrorType, handleError} from './handleError';
import {hasCaptureGroups, useSourceGroupData} from './utils';

const dataScrubSchema = z
  .object({
    method: z.enum(MethodType),
    pattern: z.string(),
    placeholder: z.string(),
    replaceCaptured: z.boolean(),
    source: z.string().min(1, t('This field is required')),
    type: z.enum(RuleType),
    dataset: z.enum(AllowedDataScrubbingDatasets),
    eventId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.type === RuleType.PATTERN && !data.pattern.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: t('This field is required'),
        path: ['pattern'],
      });
    }
  });

export type DataScrubFormModalProps = ModalRenderProps & {
  api: Client;
  endpoint: string;
  onGetNewRules: (values: EditableRule) => Rule[];
  onSubmitSuccess: (data: {relayPiiConfig: string}) => void;
  orgSlug: string;
  title: string;
  initialState?: Partial<EditableRule>;
  projectId?: Project['id'];
};

export function DataScrubFormModal({
  api,
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
    type: (initialState?.type as RuleType) ?? RuleType.CREDITCARD,
    method: (initialState?.method as MethodType) ?? MethodType.MASK,
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
  const [displayEventId, setDisplayEventId] = useState(!!sourceGroupData.eventId);
  const [sourceSuggestions, setSourceSuggestions] = useState<SourceSuggestion[]>(
    sourceGroupData.sourceSuggestions
  );
  const [eventIdError, setEventIdError] = useState<string | undefined>(undefined);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      ...initialValues,
      dataset: initialDataset,
      eventId: sourceGroupData.eventId,
    },
    validators: {
      onDynamic: dataScrubSchema,
    },
    onSubmit: async ({value}) => {
      // Strip dataset and eventId from values before creating rules
      const {dataset: _dataset, eventId: _eventId, ...ruleValues} = value;
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

  const type = useStore(form.store, state => state.values.type);

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

  const eventIdFieldBlock = (
    <form.AppField name="eventId">
      {eventIdField => (
        <eventIdField.Layout.Stack
          label={t('Event ID (Optional)')}
          hintText={t(
            'Providing an event ID will automatically provide you a list of suggested sources'
          )}
          variant="compact"
        >
          <eventIdField.Base>
            {fieldProps => (
              <Flex gap="sm" align="center" flexGrow={1}>
                <EventIdField
                  fieldProps={fieldProps}
                  value={eventIdField.state.value ?? ''}
                  onChange={eventIdField.handleChange}
                  onSuggestionsLoaded={setSourceSuggestions}
                  onErrorChange={setEventIdError}
                  orgSlug={orgSlug}
                  projectId={projectId}
                />
                <eventIdField.Meta.Status error={eventIdError} />
              </Flex>
            )}
          </eventIdField.Base>
        </eventIdField.Layout.Stack>
      )}
    </form.AppField>
  );

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
                    hintText={t('The dataset targeted by the scrubbing rule')}
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

          <form.Subscribe selector={state => state.values.method}>
            {method => (
              <Grid
                columns={
                  method === MethodType.REPLACE ? {xs: '1fr', sm: '1fr 1fr'} : '1fr'
                }
                gap={{sm: 'md'}}
              >
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
                  {methodField => (
                    <methodField.Layout.Stack
                      label={t('Method')}
                      hintText={t('What to do')}
                      variant="compact"
                    >
                      <methodField.Select
                        placeholder={t('Select method')}
                        options={methodOptions}
                        value={methodField.state.value}
                        onChange={methodField.handleChange}
                        isSearchable={false}
                      />
                    </methodField.Layout.Stack>
                  )}
                </form.AppField>
                {method === MethodType.REPLACE && (
                  <form.AppField name="placeholder">
                    {placeholderField => (
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
                  </form.AppField>
                )}
              </Grid>
            )}
          </form.Subscribe>

          <Grid
            columns={type === RuleType.PATTERN ? {xs: '1fr', sm: '1fr 1fr'} : '1fr'}
            gap={{sm: 'md'}}
          >
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
                  />
                </typeField.Layout.Stack>
              )}
            </form.AppField>
            {type === RuleType.PATTERN && (
              <form.AppField
                name="pattern"
                listeners={{
                  onChange: ({value}) => {
                    if (!hasCaptureGroups(value)) {
                      form.setFieldValue('replaceCaptured', false);
                    }
                  },
                }}
              >
                {patternField => (
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
                    <form.AppField name="replaceCaptured">
                      {replaceCapturedField => (
                        <ReplaceCapturedCheckbox
                          pattern={patternField.state.value}
                          checked={replaceCapturedField.state.value}
                          onChange={val => replaceCapturedField.handleChange(val)}
                        />
                      )}
                    </form.AppField>
                  </patternField.Layout.Stack>
                )}
              </form.AppField>
            )}
          </Grid>

          <form.AppField name="source">
            {sourceField => {
              const sourceValue = sourceField.state.value;
              const isRegExMatchesSelected = type === RuleType.PATTERN;

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
                          {displayEventId && eventIdFieldBlock}
                          <sourceField.Layout.Stack
                            label={t('Source')}
                            hintText={t(
                              'Where to look. In the simplest case this can be an attribute name.'
                            )}
                            variant="compact"
                            required
                          >
                            <sourceField.Base>
                              {fieldProps => (
                                <SourceField
                                  fieldProps={fieldProps}
                                  onChange={value => sourceField.handleChange(value)}
                                  value={sourceValue}
                                  isRegExMatchesSelected={isRegExMatchesSelected}
                                  suggestions={sourceSuggestions}
                                />
                              )}
                            </sourceField.Base>
                          </sourceField.Layout.Stack>
                          {containsRootDeepWildcard(sourceValue) && (
                            <Alert variant="warning" style={{marginTop: '8px'}}>
                              {t(
                                `Deep wildcards ('**') apply to all datasets unless negated (eg. ** || !$logs.**)`
                              )}
                            </Alert>
                          )}
                        </SourceGroup>
                      </Fragment>
                    ) : (
                      <sourceField.Layout.Stack
                        label={t('Attribute')}
                        hintText={t('The attribute to scrub')}
                        variant="compact"
                        required
                      >
                        <sourceField.Base>
                          {fieldProps => (
                            <AttributeField
                              fieldProps={fieldProps}
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
                              onBlur={(value, _event) => {
                                handleValidateAttributeField(value);
                              }}
                              projectId={projectId}
                            />
                          )}
                        </sourceField.Base>
                      </sourceField.Layout.Stack>
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
                    {displayEventId && eventIdFieldBlock}
                    <sourceField.Layout.Stack
                      label={t('Source')}
                      hintText={t(
                        'Where to look. In the simplest case this can be an attribute name.'
                      )}
                      variant="compact"
                      required
                    >
                      <sourceField.Base>
                        {fieldProps => (
                          <SourceField
                            fieldProps={fieldProps}
                            onChange={value => sourceField.handleChange(value)}
                            value={sourceValue}
                            isRegExMatchesSelected={isRegExMatchesSelected}
                            suggestions={sourceSuggestions}
                          />
                        )}
                      </sourceField.Base>
                    </sourceField.Layout.Stack>
                  </SourceGroup>
                </Fragment>
              );
            }}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="lg">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Save Rule')}</form.SubmitButton>
        </Flex>
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

const SourceGroupContainer = styled('div')<{isExpanded?: boolean}>`
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  transition-property: height;
  ${p =>
    p.isExpanded &&
    css`
      border-radius: ${p.theme.radius.md};
      border: 1px solid ${p.theme.tokens.border.primary};
      box-shadow: ${p.theme.dropShadowMedium};
      padding: ${p.theme.space.xl};
    `}
`;

function SourceGroup({
  children,
  isExpanded,
}: React.PropsWithChildren<{isExpanded?: boolean}>) {
  return (
    <SourceGroupContainer isExpanded={isExpanded}>
      <Stack gap={{xs: 'md', sm: 'xl'}}>{children}</Stack>
    </SourceGroupContainer>
  );
}

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
    gap: ${p => p.theme.space.xs};
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
