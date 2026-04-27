import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {queryOptions, useMutation} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {t} from 'sentry/locale';
import type {Choices, Choice, SelectValue} from 'sentry/types/core';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

// 0 is a valid choice but empty string, undefined, and null are not
const hasValue = (value: unknown) => !!value || value === 0;

// See docs: https://docs.sentry.io/product/integrations/integration-platform/ui-components/formfield/
export type FieldFromSchema = {
  label: string;
  name: string;
  type: 'select' | 'textarea' | 'text';
  autosize?: boolean;
  choices?: Choices;
  default?: 'issue.title' | 'issue.description';
  defaultValue?: unknown;
  depends_on?: string[];
  disabled?: boolean;
  help?: string;
  maxRows?: number;
  multiple?: boolean;
  placeholder?: string;
  required?: boolean;
  skip_load_on_open?: boolean;
  uri?: string;
};

export type SchemaFormConfig = {
  uri: string;
  description?: string;
  optional_fields?: FieldFromSchema[];
  required_fields?: FieldFromSchema[];
};

type SentryAppSetting = {
  name: string;
  value: unknown;
  label?: string;
};

type OnSubmitSuccess = (
  response: any,
  instance?: unknown,
  id?: string,
  change?: {new: unknown; old: unknown}
) => void;

type ResetValues = {
  [key: string]: any;
  settings?: SentryAppSetting[];
};

type FieldGroups = Omit<SchemaFormConfig, 'uri' | 'description'>;

type Props = {
  action: 'create' | 'link';
  appName: string;
  config: SchemaFormConfig;
  element: 'issue-link' | 'alert-rule-action';
  onSubmitSuccess: OnSubmitSuccess;
  sentryAppInstallationUuid: string;
  /**
   * Additional form data to submit with the request
   */
  extraFields?: Record<string, unknown>;
  /**
   * Additional body parameters to submit with the request
   */
  extraRequestBody?: Record<string, unknown>;
  /**
   * Function to provide fields with pre-written data if a default is specified
   */
  getFieldDefault?: (field: FieldFromSchema) => string;
  /**
   * Object containing reset values for fields if previously entered, in case this form is unmounted
   */
  resetValues?: ResetValues;
};

function cloneSchemaFields(fields?: FieldFromSchema[]) {
  return (
    fields?.map(field => ({
      ...field,
      choices: field.choices ? [...field.choices] : field.choices,
      depends_on: field.depends_on ? [...field.depends_on] : field.depends_on,
    })) ?? []
  );
}

function cloneSchemaConfig(config: SchemaFormConfig): FieldGroups {
  return {
    required_fields: cloneSchemaFields(config.required_fields),
    optional_fields: cloneSchemaFields(config.optional_fields),
  };
}

function getAllSchemaFields(fieldGroups: FieldGroups) {
  return [...(fieldGroups.required_fields ?? []), ...(fieldGroups.optional_fields ?? [])];
}

function findSchemaField(fieldGroups: FieldGroups, fieldName: string) {
  return getAllSchemaFields(fieldGroups).find(field => field.name === fieldName);
}

function updateSchemaFieldChoices(
  fieldGroups: FieldGroups,
  fieldName: string,
  choices: Choices
): FieldGroups {
  const updateGroup = (fields?: FieldFromSchema[]) =>
    fields?.map(field =>
      field.name === fieldName ? {...field, choices: [...choices]} : field
    ) ?? [];

  return {
    required_fields: updateGroup(fieldGroups.required_fields),
    optional_fields: updateGroup(fieldGroups.optional_fields),
  };
}

function getSavedSetting(resetValues: ResetValues | undefined, fieldName: string) {
  return resetValues?.settings?.find(setting => setting.name === fieldName);
}

function getResetInitialValues(resetValues: ResetValues | undefined) {
  return Object.fromEntries(
    (resetValues?.settings ?? []).map(setting => [setting.name, setting.value])
  );
}

function choiceLabelToString(label: Choice[1]) {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : '';
}

function mergeFieldChoices(
  field: FieldFromSchema,
  resetValues: ResetValues | undefined
): Array<[string, string]> {
  const choices =
    field.choices?.map(
      ([value, label]) => [String(value), choiceLabelToString(label)] as [string, string]
    ) ?? [];

  const savedSetting = getSavedSetting(resetValues, field.name);
  const savedValue = savedSetting?.value;
  if (
    (typeof savedValue === 'string' || typeof savedValue === 'number') &&
    savedSetting?.label &&
    !choices.some(([value]) => value === String(savedValue))
  ) {
    return [[String(savedValue), savedSetting.label], ...choices];
  }

  return choices;
}

function toSelectValues(
  choices: ReadonlyArray<[string, string]>
): Array<SelectValue<string>> {
  return choices.map(([value, label]) => ({value, label}));
}

function getBaseFieldDefaultValue(
  field: FieldFromSchema,
  externalDefaultValues: Record<string, unknown>,
  getFieldDefault: ((field: FieldFromSchema) => string) | undefined,
  resetValues: ResetValues | undefined
) {
  if (Object.prototype.hasOwnProperty.call(externalDefaultValues, field.name)) {
    return externalDefaultValues[field.name];
  }

  let defaultValue = field.defaultValue;

  if (field.default && getFieldDefault) {
    defaultValue = getFieldDefault(field);
  }

  const resetValue = getSavedSetting(resetValues, field.name);
  if (resetValue) {
    defaultValue = resetValue.value;
  }

  return defaultValue;
}

function getEffectiveFieldValue({
  currentFormValues,
  externalDefaultValues,
  fieldGroups,
  fieldName,
  getFieldDefault,
  resetValues,
}: {
  currentFormValues: Record<string, unknown>;
  externalDefaultValues: Record<string, unknown>;
  fieldGroups: FieldGroups;
  fieldName: string;
  getFieldDefault?: (field: FieldFromSchema) => string;
  resetValues?: ResetValues;
}) {
  if (Object.prototype.hasOwnProperty.call(currentFormValues, fieldName)) {
    return currentFormValues[fieldName];
  }

  const field = findSchemaField(fieldGroups, fieldName);
  if (!field) {
    return undefined;
  }

  return getBaseFieldDefaultValue(
    field,
    externalDefaultValues,
    getFieldDefault,
    resetValues
  );
}

export function SentryAppExternalForm({
  action,
  appName,
  config,
  element,
  onSubmitSuccess,
  sentryAppInstallationUuid,
  extraFields,
  extraRequestBody,
  getFieldDefault,
  resetValues,
}: Props) {
  const api = useApi({persistInFlight: true});
  const [fieldGroups, setFieldGroups] = useState<FieldGroups>(() =>
    cloneSchemaConfig(config)
  );
  const currentFormValuesRef = useRef<Record<string, unknown>>({});
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, unknown>>(
    {}
  );
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown>>({});
  const [externalDefaultValues, setExternalDefaultValues] = useState<
    Record<string, unknown>
  >({});
  const [asyncOptionsCache, setAsyncOptionsCache] = useState<Record<string, Choices>>({});
  const [isFetchingDependentFields, setIsFetchingDependentFields] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  const serializedExtraFields = JSON.stringify(extraFields ?? {});
  const serializedExtraRequestBody = JSON.stringify(extraRequestBody ?? {});

  const fetchFieldChoices = useCallback(
    async ({
      currentValues,
      defaultValues,
      field,
      input,
      nextFieldGroups,
    }: {
      currentValues: Record<string, unknown>;
      defaultValues: Record<string, unknown>;
      field: FieldFromSchema;
      input: string;
      nextFieldGroups: FieldGroups;
    }) => {
      if (!field.uri) {
        return {choices: field.choices ?? [], defaultValue: undefined};
      }

      const query: Record<string, unknown> = {
        ...extraRequestBody,
        query: input,
        uri: field.uri,
      };

      if (field.depends_on?.length) {
        const dependentData = Object.fromEntries(
          field.depends_on.map(dependentField => [
            dependentField,
            getEffectiveFieldValue({
              currentFormValues: currentValues,
              externalDefaultValues: defaultValues,
              fieldGroups: nextFieldGroups,
              fieldName: dependentField,
              getFieldDefault,
              resetValues,
            }),
          ])
        );
        query.dependentData = JSON.stringify(dependentData);
      }

      const response = await api.requestPromise(
        `/sentry-app-installations/${sentryAppInstallationUuid}/external-requests/`,
        {query}
      );

      return {
        choices: Array.isArray(response?.choices) ? (response.choices as Choices) : [],
        defaultValue: response?.defaultValue,
      };
    },
    [api, extraRequestBody, getFieldDefault, resetValues, sentryAppInstallationUuid]
  );

  useEffect(() => {
    let isCancelled = false;
    const nextFieldGroups = cloneSchemaConfig(config);
    const nextTriggerFieldNames = new Set(
      getAllSchemaFields(nextFieldGroups).flatMap(field => field.depends_on ?? [])
    );
    const nextInitialValues =
      element === 'alert-rule-action' ? getResetInitialValues(resetValues) : {};

    setFieldGroups(nextFieldGroups);
    currentFormValuesRef.current = nextInitialValues;
    setDynamicFieldValues(
      Object.fromEntries(
        Object.entries(nextInitialValues).filter(([name]) =>
          nextTriggerFieldNames.has(name)
        )
      )
    );
    setFormInitialValues(nextInitialValues);
    setExternalDefaultValues({});
    setAsyncOptionsCache({});

    const initializeDependentFields = async () => {
      const fieldsToPrefetch = getAllSchemaFields(nextFieldGroups).filter(
        field =>
          field.depends_on?.length &&
          field.depends_on.every(dependentField =>
            hasValue(
              getEffectiveFieldValue({
                currentFormValues: {},
                externalDefaultValues: {},
                fieldGroups: nextFieldGroups,
                fieldName: dependentField,
                getFieldDefault,
                resetValues,
              })
            )
          )
      );

      if (!fieldsToPrefetch.length) {
        return;
      }

      const results = await Promise.all(
        fieldsToPrefetch.map(async field => ({
          fieldName: field.name,
          ...(await fetchFieldChoices({
            currentValues: {},
            defaultValues: {},
            field,
            input: '',
            nextFieldGroups,
          })),
        }))
      );

      if (isCancelled) {
        return;
      }

      let updatedFieldGroups = nextFieldGroups;
      const nextDefaultValues: Record<string, unknown> = {};

      for (const result of results) {
        updatedFieldGroups = updateSchemaFieldChoices(
          updatedFieldGroups,
          result.fieldName,
          result.choices
        );

        if (result.defaultValue !== undefined) {
          nextDefaultValues[result.fieldName] = result.defaultValue;
        }
      }

      setFieldGroups(updatedFieldGroups);
      setFormInitialValues({
        ...nextInitialValues,
        ...nextDefaultValues,
      });
      setExternalDefaultValues(nextDefaultValues);
      setFormVersion(version => version + 1);
    };

    void initializeDependentFields();

    return () => {
      isCancelled = true;
    };
  }, [
    action,
    config,
    element,
    fetchFieldChoices,
    getFieldDefault,
    resetValues,
    serializedExtraFields,
    serializedExtraRequestBody,
  ]);

  const triggerFieldNames = useMemo(
    () =>
      new Set(getAllSchemaFields(fieldGroups).flatMap(field => field.depends_on ?? [])),
    [fieldGroups]
  );

  const adapterFields = useMemo((): JsonFormAdapterFieldConfig[] => {
    const mapField = (
      field: FieldFromSchema,
      required: boolean
    ): JsonFormAdapterFieldConfig => {
      const defaultValue = getBaseFieldDefaultValue(
        field,
        externalDefaultValues,
        getFieldDefault,
        resetValues
      );

      const disabled =
        field.disabled ||
        !!field.depends_on?.some(
          dependentField =>
            !hasValue(
              getEffectiveFieldValue({
                currentFormValues: dynamicFieldValues,
                externalDefaultValues,
                fieldGroups,
                fieldName: dependentField,
                getFieldDefault,
                resetValues,
              })
            )
        );

      switch (field.type) {
        case 'text':
          return {
            default: defaultValue,
            disabled,
            help: field.help,
            label: field.label,
            name: field.name,
            placeholder: field.placeholder,
            required,
            type: 'string',
            updatesForm: triggerFieldNames.has(field.name),
          };
        case 'textarea':
          return {
            default: defaultValue,
            disabled,
            help: field.help,
            label: field.label,
            name: field.name,
            placeholder: field.placeholder,
            required,
            type: 'textarea',
            updatesForm: triggerFieldNames.has(field.name),
          };
        case 'select':
          return {
            choices: mergeFieldChoices(field, resetValues),
            default: defaultValue,
            disabled,
            help: field.help,
            label: field.label,
            multiple: field.multiple,
            name: field.name,
            placeholder: field.placeholder ?? 'Type to search',
            required,
            type: 'select',
            updatesForm: triggerFieldNames.has(field.name),
          };
        default:
          return {
            default: defaultValue,
            disabled,
            help: field.help,
            label: field.label,
            name: field.name,
            placeholder: field.placeholder,
            required,
            type: 'string',
            updatesForm: triggerFieldNames.has(field.name),
          };
      }
    };

    return [
      ...(fieldGroups.required_fields ?? []).map(field => mapField(field, true)),
      ...(fieldGroups.optional_fields ?? []).map(field => mapField(field, false)),
    ];
  }, [
    dynamicFieldValues,
    externalDefaultValues,
    fieldGroups,
    getFieldDefault,
    resetValues,
    triggerFieldNames,
  ]);

  const customAsyncQueryOptions = useMemo(() => {
    const nextQueryOptions: NonNullable<
      ComponentProps<typeof BackendJsonSubmitForm>['customAsyncQueryOptions']
    > = {};

    for (const field of getAllSchemaFields(fieldGroups)) {
      if (field.type !== 'select' || !field.uri || (field.choices?.length ?? 0) > 0) {
        continue;
      }

      nextQueryOptions[field.name] = debouncedInput =>
        // eslint-disable-next-line @tanstack/query/exhaustive-deps -- field/default state drives the request key; refs and state setters should not affect cache identity.
        queryOptions({
          initialData: toSelectValues(mergeFieldChoices(field, resetValues)),
          queryKey: [
            'sentry-app-external-request',
            sentryAppInstallationUuid,
            field.name,
            field.uri,
            debouncedInput,
            JSON.stringify(mergeFieldChoices(field, resetValues)),
            dynamicFieldValues,
            externalDefaultValues,
            serializedExtraRequestBody,
          ],
          queryFn: async (): Promise<Array<SelectValue<string>>> => {
            if (!debouncedInput) {
              return toSelectValues(mergeFieldChoices(field, resetValues));
            }

            const {choices} = await fetchFieldChoices({
              currentValues: currentFormValuesRef.current,
              defaultValues: externalDefaultValues,
              field,
              input: debouncedInput,
              nextFieldGroups: fieldGroups,
            });

            setAsyncOptionsCache(prev => ({
              ...prev,
              [field.name]: choices,
            }));

            return toSelectValues(
              choices.map(
                ([value, label]) =>
                  [String(value), choiceLabelToString(label)] as [string, string]
              )
            );
          },
        });
    }

    return nextQueryOptions;
  }, [
    dynamicFieldValues,
    externalDefaultValues,
    fetchFieldChoices,
    fieldGroups,
    resetValues,
    sentryAppInstallationUuid,
    serializedExtraRequestBody,
  ]);

  const handleValueChange = useCallback(
    (fieldName: string, value: unknown) => {
      currentFormValuesRef.current = {
        ...currentFormValuesRef.current,
        [fieldName]: value,
      };
      if (triggerFieldNames.has(fieldName)) {
        setDynamicFieldValues(prev => ({...prev, [fieldName]: value}));
      }
    },
    [triggerFieldNames]
  );

  const handleFieldChange = useCallback(
    async (fieldName: string, value: unknown) => {
      const impactedFields = getAllSchemaFields(fieldGroups).filter(field =>
        field.depends_on?.includes(fieldName)
      );

      if (!impactedFields.length) {
        return;
      }

      const nextCurrentValues = {...currentFormValuesRef.current, [fieldName]: value};
      const nextDefaultValues = {...externalDefaultValues};

      for (const impactedField of impactedFields) {
        delete nextCurrentValues[impactedField.name];
        delete nextDefaultValues[impactedField.name];
      }

      currentFormValuesRef.current = nextCurrentValues;
      setDynamicFieldValues(
        Object.fromEntries(
          Object.entries(nextCurrentValues).filter(([name]) =>
            triggerFieldNames.has(name)
          )
        )
      );
      setFormInitialValues(nextCurrentValues);
      setExternalDefaultValues(nextDefaultValues);
      setIsFetchingDependentFields(true);

      try {
        const results = await Promise.all(
          impactedFields.map(async field => ({
            fieldName: field.name,
            ...(await fetchFieldChoices({
              currentValues: nextCurrentValues,
              defaultValues: nextDefaultValues,
              field,
              input: '',
              nextFieldGroups: fieldGroups,
            })),
          }))
        );

        let updatedFieldGroups = fieldGroups;
        const updatedDefaultValues = {...nextDefaultValues};

        for (const result of results) {
          updatedFieldGroups = updateSchemaFieldChoices(
            updatedFieldGroups,
            result.fieldName,
            result.choices
          );

          if (result.defaultValue !== undefined) {
            updatedDefaultValues[result.fieldName] = result.defaultValue;
          }
        }

        setFieldGroups(updatedFieldGroups);
        setFormInitialValues({
          ...nextCurrentValues,
          ...updatedDefaultValues,
        });
        setExternalDefaultValues(updatedDefaultValues);
        setFormVersion(version => version + 1);
      } finally {
        setIsFetchingDependentFields(false);
      }
    },
    [externalDefaultValues, fetchFieldChoices, fieldGroups, triggerFieldNames]
  );

  const choicesByField = useMemo(() => {
    const lookup: Record<string, Choices> = {};

    for (const field of getAllSchemaFields(fieldGroups)) {
      if (field.type !== 'select') {
        continue;
      }
      lookup[field.name] = mergeFieldChoices(field, resetValues);
    }

    return {
      ...lookup,
      ...asyncOptionsCache,
    };
  }, [asyncOptionsCache, fieldGroups, resetValues]);

  const submitDisabled = isFetchingDependentFields;

  const {mutateAsync: createExternalIssue} = useMutation<
    unknown,
    RequestError,
    Record<string, unknown>
  >({
    mutationFn: values =>
      fetchMutation({
        url: `/sentry-app-installations/${sentryAppInstallationUuid}/external-issue-actions/`,
        method: 'POST',
        data: {
          ...extraFields,
          ...values,
          action,
          uri: config.uri,
        },
      }),
    onSuccess: response => {
      onSubmitSuccess(response);
    },
    onError: error => {
      if (!(error instanceof Error)) {
        addErrorMessage(t('Unable to %s %s issue.', action, appName));
      }
    },
  });

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      if (element === 'alert-rule-action') {
        const settings = Object.entries(values).map(([name, value]) => {
          const field = findSchemaField(fieldGroups, name);
          const savedSetting: SentryAppSetting = {name, value};

          if (field?.uri && !Array.isArray(value)) {
            const selectedChoice = choicesByField[name]?.find(
              ([choiceValue]) => choiceValue === value
            );

            if (selectedChoice) {
              savedSetting.label = choiceLabelToString(selectedChoice[1]);
            }
          }

          return savedSetting;
        });

        onSubmitSuccess({
          hasSchemaFormConfig: true,
          sentryAppInstallationUuid,
          settings,
        });
        return;
      }

      return createExternalIssue(values);
    },
    [
      choicesByField,
      createExternalIssue,
      element,
      fieldGroups,
      onSubmitSuccess,
      sentryAppInstallationUuid,
    ]
  );

  const formKey = useMemo(
    () =>
      `${action}:${formVersion}:${adapterFields
        .map(field => `${field.name}:${JSON.stringify(field.default)}`)
        .join(',')}`,
    [action, adapterFields, formVersion]
  );

  if (!sentryAppInstallationUuid) {
    return null;
  }

  return (
    <BackendJsonSubmitForm
      key={formKey}
      fields={adapterFields}
      initialValues={formInitialValues}
      onSubmit={handleSubmit}
      submitLabel={t('Save Changes')}
      submitDisabled={submitDisabled}
      onFieldChange={handleFieldChange}
      onValueChange={handleValueChange}
      customAsyncQueryOptions={customAsyncQueryOptions}
      footer={({SubmitButton, disabled}) => (
        <Flex justify="end" paddingTop="xl">
          <SubmitButton disabled={disabled}>{t('Save Changes')}</SubmitButton>
        </Flex>
      )}
    />
  );
}
