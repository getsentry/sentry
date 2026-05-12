import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import * as Sentry from '@sentry/react';
import {queryOptions, useMutation, useQueryClient} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {t} from 'sentry/locale';
import type {Choices, Choice, SelectValue} from 'sentry/types/core';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {unreachable} from 'sentry/utils/unreachable';
import {useApi} from 'sentry/utils/useApi';

// 0 is a valid choice but empty string, undefined, and null are not
const hasValue = (value: unknown) => !!value || value === 0;

// See docs: https://docs.sentry.io/product/integrations/integration-platform/ui-components/formfield/
type FieldFromSchema = {
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

type SchemaFormConfig = {
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

type AlertRuleSubmitPayload = {
  hasSchemaFormConfig: true;
  sentryAppInstallationUuid: string;
  settings: SentryAppSetting[];
};

type OnSubmitSuccess = (
  response: unknown,
  instance?: unknown,
  id?: string,
  change?: {new: unknown; old: unknown}
) => void;

type ResetValues = {
  [key: string]: unknown;
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

function cloneSchemaFields(
  fields?: FieldFromSchema[],
  getFieldDefault?: (field: FieldFromSchema) => string
) {
  return (
    fields?.map(field => {
      const nextField: FieldFromSchema = {
        ...field,
        choices: field.choices ? [...field.choices] : field.choices,
        depends_on: field.depends_on ? [...field.depends_on] : field.depends_on,
      };

      // Apply textarea ergonomics regardless of whether the field has a
      // schema `default`. `getFieldDefault` mutates these as a side effect,
      // but only runs when `default` is set — so a textarea without a default
      // would otherwise render unbounded. Honor schema-provided values when
      // present.
      if (nextField.type === 'textarea') {
        if (nextField.maxRows === undefined) nextField.maxRows = 10;
        if (nextField.autosize === undefined) nextField.autosize = true;
      }

      if (nextField.default && getFieldDefault) {
        nextField.defaultValue = getFieldDefault(nextField);
      }

      return nextField;
    }) ?? []
  );
}

function cloneSchemaConfig(
  config: SchemaFormConfig,
  getFieldDefault?: (field: FieldFromSchema) => string
): FieldGroups {
  return {
    required_fields: cloneSchemaFields(config.required_fields, getFieldDefault),
    optional_fields: cloneSchemaFields(config.optional_fields, getFieldDefault),
  };
}

function cloneFieldGroups(fieldGroups: FieldGroups): FieldGroups {
  return {
    required_fields: cloneSchemaFields(fieldGroups.required_fields),
    optional_fields: cloneSchemaFields(fieldGroups.optional_fields),
  };
}

function normalizeChoices(
  choices: readonly Choice[] | undefined
): Array<[string, string]> {
  return (
    choices?.map(
      ([value, label]) => [String(value), choiceLabelToString(label)] as [string, string]
    ) ?? []
  );
}

function omitValues(
  values: Record<string, unknown>,
  fieldNames: Set<string>
): Record<string, unknown> {
  const nextValues = {...values};

  for (const fieldName of fieldNames) {
    delete nextValues[fieldName];
  }

  return nextValues;
}

function getTriggerFieldValues(
  values: Record<string, unknown>,
  triggerFieldNames: Set<string>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(([name]) => triggerFieldNames.has(name))
  );
}

/**
 * Returns a stable reference to `value` that only changes when `serializedValue`
 * changes. Use when a prop's reference identity churns each render but its
 * structural content rarely does — pass the stringified content as
 * `serializedValue` and downstream hooks/memos won't re-run on no-op changes.
 */
function useSerializedValueMemo<T>(value: T, serializedValue: string): T {
  const ref = useRef<{serializedValue: string; value: T} | null>(null);

  if (ref.current?.serializedValue !== serializedValue) {
    ref.current = {serializedValue, value};
  }

  return ref.current.value;
}

/**
 * Apply a batch of field-choice fetch results to a schema: replace each
 * impacted field's `choices` and merge any returned `defaultValue`s.
 */
function foldChoiceResults(
  baseFieldGroups: FieldGroups,
  baseDefaultValues: Record<string, unknown>,
  results: ReadonlyArray<{
    choices: Choices;
    fieldName: string;
    defaultValue?: unknown;
  }>
): {
  nextDefaultValues: Record<string, unknown>;
  updatedFieldGroups: FieldGroups;
} {
  let updatedFieldGroups = baseFieldGroups;
  const nextDefaultValues = {...baseDefaultValues};
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
  return {updatedFieldGroups, nextDefaultValues};
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
  const normalizedChoices = normalizeChoices(choices);
  const updateGroup = (fields?: FieldFromSchema[]) =>
    fields?.map(field =>
      field.name === fieldName ? {...field, choices: normalizedChoices} : field
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
  const choices = normalizeChoices(field.choices);

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
  resetValues: ResetValues | undefined
) {
  if (Object.prototype.hasOwnProperty.call(externalDefaultValues, field.name)) {
    return externalDefaultValues[field.name];
  }

  let defaultValue = field.defaultValue;

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
  resetValues,
}: {
  currentFormValues: Record<string, unknown>;
  externalDefaultValues: Record<string, unknown>;
  fieldGroups: FieldGroups;
  fieldName: string;
  resetValues?: ResetValues;
}) {
  if (Object.prototype.hasOwnProperty.call(currentFormValues, fieldName)) {
    return currentFormValues[fieldName];
  }

  const field = findSchemaField(fieldGroups, fieldName);
  if (!field) {
    return;
  }

  return getBaseFieldDefaultValue(field, externalDefaultValues, resetValues);
}

export function SentryAppExternalFormNew({
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
  const queryClient = useQueryClient();
  const serializedExtraFields = JSON.stringify(extraFields ?? {});
  const serializedExtraRequestBody = JSON.stringify(extraRequestBody ?? {});
  const serializedResetValues = JSON.stringify(resetValues ?? {});
  const nextResolvedFieldGroups = cloneSchemaConfig(config, getFieldDefault);
  const serializedResolvedFieldGroups = JSON.stringify(nextResolvedFieldGroups);

  const normalizedExtraFields = useSerializedValueMemo(
    extraFields ?? {},
    serializedExtraFields
  );
  const normalizedExtraRequestBody = useSerializedValueMemo(
    extraRequestBody ?? {},
    serializedExtraRequestBody
  );
  const normalizedResetValues = useSerializedValueMemo(
    resetValues,
    serializedResetValues
  );
  const resolvedFieldGroups = useSerializedValueMemo(
    nextResolvedFieldGroups,
    serializedResolvedFieldGroups
  );

  const [fieldGroups, setFieldGroups] = useState<FieldGroups>(() =>
    cloneFieldGroups(resolvedFieldGroups)
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
  const dependentFetchVersionRef = useRef(0);
  const [isFetchingDependentFields, setIsFetchingDependentFields] = useState(false);
  // Mount-time cascade only. Drives the whole-form <LoadingIndicator/> so the
  // form doesn't render with empty selects on open. Click-time cascades use
  // isFetchingDependentFields above, which only disables submit.
  const [isFetchingInitialCascade, setIsFetchingInitialCascade] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

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
        ...normalizedExtraRequestBody,
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
              resetValues: normalizedResetValues,
            }),
          ])
        );
        query.dependentData = JSON.stringify(dependentData);
      }

      const response = await queryClient.fetchQuery({
        queryKey: [
          'sentry-app-external-request',
          sentryAppInstallationUuid,
          field.uri,
          query,
        ],
        queryFn: () =>
          api.requestPromise(
            `/sentry-app-installations/${sentryAppInstallationUuid}/external-requests/`,
            {query}
          ),
      });

      return {
        choices: Array.isArray(response?.choices) ? (response.choices as Choices) : [],
        defaultValue: response?.defaultValue,
      };
    },
    [
      api,
      normalizedExtraRequestBody,
      normalizedResetValues,
      queryClient,
      sentryAppInstallationUuid,
    ]
  );

  // BFS over the dependency graph. A newly-defaulted field can itself be a
  // trigger for fields that depend on it (transitive cascade A → B → C),
  // so we process triggers level by level until no further dependents
  // remain. processedTriggers and fetchedFields prevent re-processing on
  // diamond shapes (A → B, A → C, B → D, C → D) and cycles.
  const cascadeFetchDependents = useCallback(
    async ({
      seedTriggers,
      initialFieldGroups,
      initialDefaultValues,
      initialValues,
      requestVersion,
    }: {
      initialDefaultValues: Record<string, unknown>;
      initialFieldGroups: FieldGroups;
      initialValues: Record<string, unknown>;
      requestVersion: number;
      seedTriggers: string[];
    }): Promise<{
      defaultValues: Record<string, unknown>;
      fieldGroups: FieldGroups;
      impactedNames: Set<string>;
      values: Record<string, unknown>;
    } | null> => {
      const triggerQueue = [...seedTriggers];
      const processedTriggers = new Set<string>();
      const fetchedFields = new Set<string>();
      const impactedNames = new Set<string>();
      let workingFieldGroups = initialFieldGroups;
      let workingDefaults = initialDefaultValues;
      let workingValues = initialValues;

      while (triggerQueue.length > 0) {
        const trigger = triggerQueue.shift()!;
        if (processedTriggers.has(trigger)) continue;
        processedTriggers.add(trigger);

        const dependentFields = getAllSchemaFields(workingFieldGroups).filter(
          field => field.depends_on?.includes(trigger) && !fetchedFields.has(field.name)
        );
        if (!dependentFields.length) continue;

        for (const field of dependentFields) {
          fetchedFields.add(field.name);
          impactedNames.add(field.name);
        }

        // Snapshot the working state for this iteration so the closure
        // below doesn't capture vars reassigned by later iterations.
        const iterFieldGroups = workingFieldGroups;
        const iterDefaults = workingDefaults;
        const iterValues = workingValues;

        const results = await Promise.all(
          dependentFields.map(async field => ({
            fieldName: field.name,
            ...(await fetchFieldChoices({
              currentValues: iterValues,
              defaultValues: iterDefaults,
              field,
              input: '',
              nextFieldGroups: iterFieldGroups,
            })),
          }))
        );

        if (requestVersion !== dependentFetchVersionRef.current) return null;

        const folded = foldChoiceResults(workingFieldGroups, workingDefaults, results);
        workingFieldGroups = folded.updatedFieldGroups;
        workingDefaults = folded.nextDefaultValues;

        for (const result of results) {
          if (result.defaultValue === undefined) continue;
          // Preserve saved/user values: only apply a fetched defaultValue if
          // the field doesn't already have an effective value. Without this
          // check, the mount-time cascade clobbers a saved selection (e.g.
          // alert-rule-action settings round-tripping from the DB) with the
          // schema's default, and the next BFS iteration fetches its
          // dependents with the wrong parent value.
          if (hasValue(workingValues[result.fieldName])) continue;
          workingValues = {...workingValues, [result.fieldName]: result.defaultValue};
          triggerQueue.push(result.fieldName);
        }
      }

      return {
        defaultValues: workingDefaults,
        fieldGroups: workingFieldGroups,
        impactedNames,
        values: workingValues,
      };
    },
    [fetchFieldChoices]
  );

  // Reset all derived state whenever the form's identity changes. `action` is
  // included even though the body doesn't read it: when create/link share an
  // identical schema, `resolvedFieldGroups` is reference-stable, so without
  // `action` here a tab flip would remount BackendJsonSubmitForm via formKey
  // but leave currentFormValuesRef and the other mirrors holding stale values
  // from the previous action — which would then poison dependentData on the
  // next cascade fetch.
  useEffect(() => {
    const nextFieldGroups = cloneFieldGroups(resolvedFieldGroups);
    const nextTriggerFieldNames = new Set(
      getAllSchemaFields(nextFieldGroups).flatMap(field => field.depends_on ?? [])
    );
    const nextInitialValues =
      element === 'alert-rule-action' ? getResetInitialValues(normalizedResetValues) : {};

    // Start in the loading state if any field already has a value at mount;
    // the prefetch effect below cascades from those seeds and will clear the
    // flag in its finally block. Avoids the "empty select rendered before
    // options arrive" flash since the form renders <LoadingIndicator/> until
    // the cascade resolves.
    const willCascade = getAllSchemaFields(nextFieldGroups).some(field =>
      hasValue(
        getEffectiveFieldValue({
          currentFormValues: {},
          externalDefaultValues: {},
          fieldGroups: nextFieldGroups,
          fieldName: field.name,
          resetValues: normalizedResetValues,
        })
      )
    );

    dependentFetchVersionRef.current += 1;
    currentFormValuesRef.current = nextInitialValues;
    setFieldGroups(nextFieldGroups);
    setDynamicFieldValues(
      getTriggerFieldValues(nextInitialValues, nextTriggerFieldNames)
    );
    setFormInitialValues(nextInitialValues);
    setExternalDefaultValues({});
    setAsyncOptionsCache({});
    setIsFetchingDependentFields(false);
    setIsFetchingInitialCascade(willCascade);
  }, [action, element, normalizedResetValues, resolvedFieldGroups]);

  // After the reset above, cascade-fetch dependent fields starting from any
  // field that already has a value (schema-baked defaultValue, resetValues
  // entry, or getFieldDefault result). Seeding the BFS this way lets chained
  // schemas (A → B → C) populate transitively on mount, matching the same
  // behavior as user-driven changes via handleFieldChange.
  useEffect(() => {
    const nextFieldGroups = cloneFieldGroups(resolvedFieldGroups);
    const initialFieldValues: Record<string, unknown> = {};
    for (const field of getAllSchemaFields(nextFieldGroups)) {
      const value = getEffectiveFieldValue({
        currentFormValues: {},
        externalDefaultValues: {},
        fieldGroups: nextFieldGroups,
        fieldName: field.name,
        resetValues: normalizedResetValues,
      });
      if (hasValue(value)) {
        initialFieldValues[field.name] = value;
      }
    }
    const seedTriggers = Object.keys(initialFieldValues);
    if (!seedTriggers.length) return;

    const requestVersion = dependentFetchVersionRef.current + 1;
    dependentFetchVersionRef.current = requestVersion;

    let isCancelled = false;

    const runPrefetch = async () => {
      try {
        const cascadeResult = await cascadeFetchDependents({
          seedTriggers,
          initialFieldGroups: nextFieldGroups,
          initialDefaultValues: {},
          initialValues: initialFieldValues,
          requestVersion,
        });

        if (isCancelled || !cascadeResult?.impactedNames.size) {
          return;
        }

        // cascadeResult.values is the merged effective state: seeded
        // initialFieldValues (which already includes resetValues entries and
        // baked schema defaults via getEffectiveFieldValue) with
        // cascade-fetched defaults layered on only for fields that had no
        // value yet. Using it directly preserves a saved selection through
        // the mount cascade — e.g. an alert-rule-action's settings
        // round-tripping from the DB no longer get clobbered by the
        // schema's default for that field.
        setFieldGroups(cascadeResult.fieldGroups);
        setFormInitialValues(cascadeResult.values);
        setExternalDefaultValues(cascadeResult.defaultValues);
        setFormVersion(version => version + 1);
      } finally {
        if (!isCancelled && requestVersion === dependentFetchVersionRef.current) {
          setIsFetchingInitialCascade(false);
        }
      }
    };

    runPrefetch().catch(error => {
      // Match the click-cascade error handling: surface a toast so the user
      // knows a dependent fetch failed instead of silently leaving the
      // affected select blank.
      addErrorMessage(t("Couldn't load options for some fields."));
      Sentry.captureException(error, {
        tags: {
          sentry_app: appName,
          form_element: element,
          form_action: action,
        },
        extra: {
          sentryAppInstallationUuid,
          configUri: config.uri,
          seedTriggers,
        },
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [
    action,
    appName,
    cascadeFetchDependents,
    config.uri,
    element,
    normalizedResetValues,
    resolvedFieldGroups,
    sentryAppInstallationUuid,
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
        normalizedResetValues
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
                resetValues: normalizedResetValues,
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
            autosize: field.autosize,
            default: defaultValue,
            disabled,
            help: field.help,
            label: field.label,
            maxRows: field.maxRows,
            name: field.name,
            placeholder: field.placeholder,
            required,
            type: 'textarea',
            updatesForm: triggerFieldNames.has(field.name),
          };
        case 'select':
          return {
            choices: mergeFieldChoices(field, normalizedResetValues),
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
          return unreachable(field.type);
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
    normalizedResetValues,
    triggerFieldNames,
  ]);

  const customAsyncQueryOptions = useMemo(() => {
    const nextQueryOptions: NonNullable<
      ComponentProps<typeof BackendJsonSubmitForm>['customAsyncQueryOptions']
    > = {};

    for (const field of getAllSchemaFields(fieldGroups)) {
      if (field.type !== 'select' || !field.uri) {
        continue;
      }

      nextQueryOptions[field.name] = debouncedInput =>
        // eslint-disable-next-line @tanstack/query/exhaustive-deps -- currentFormValuesRef.current is a ref read at request time and setAsyncOptionsCache has stable identity; neither belongs in the cache key.
        queryOptions({
          initialData: toSelectValues(mergeFieldChoices(field, normalizedResetValues)),
          queryKey: [
            'sentry-app-external-request',
            sentryAppInstallationUuid,
            field.name,
            field.uri,
            debouncedInput,
            mergeFieldChoices(field, normalizedResetValues),
            dynamicFieldValues,
            externalDefaultValues,
            serializedExtraRequestBody,
            fetchFieldChoices,
            fieldGroups,
          ],
          queryFn: async (): Promise<Array<SelectValue<string>>> => {
            if (!debouncedInput) {
              return toSelectValues(mergeFieldChoices(field, normalizedResetValues));
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
              [field.name]: normalizeChoices(choices),
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
    normalizedResetValues,
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
      const directlyImpactedFields = getAllSchemaFields(fieldGroups).filter(field =>
        field.depends_on?.includes(fieldName)
      );

      if (!directlyImpactedFields.length) {
        return;
      }

      const requestVersion = dependentFetchVersionRef.current + 1;
      dependentFetchVersionRef.current = requestVersion;

      // Compute the BFS seed state without touching React state mid-flight.
      // The user's pick is already visible through TanStack form's own internal
      // state (fieldApi.handleChange ran before us), so we don't need to remount
      // the form via setFormInitialValues / setExternalDefaultValues here. Doing
      // that synchronously triggered a re-render that could bump
      // dependentFetchVersionRef during the cascade's await, aborting the BFS
      // and leaving the dependent fields stuck with their pre-cascade values.
      const directlyImpactedNames = new Set(
        directlyImpactedFields.map(field => field.name)
      );
      const nextCurrentValues = omitValues(
        {...currentFormValuesRef.current, [fieldName]: value},
        directlyImpactedNames
      );
      const nextDefaultValues = {...externalDefaultValues};
      for (const name of directlyImpactedNames) delete nextDefaultValues[name];

      currentFormValuesRef.current = nextCurrentValues;
      setIsFetchingDependentFields(true);

      let allImpactedNames = new Set<string>();
      try {
        const cascadeResult = await cascadeFetchDependents({
          seedTriggers: [fieldName],
          initialFieldGroups: fieldGroups,
          initialDefaultValues: nextDefaultValues,
          initialValues: nextCurrentValues,
          requestVersion,
        });
        if (!cascadeResult) return;
        allImpactedNames = cascadeResult.impactedNames;

        // Only apply newly-resolved defaults for the impacted fields.
        // Spreading the full defaultValues here would clobber the user's
        // just-picked trigger value (the field that started the cascade)
        // with its previous schema default.
        const impactedDefaults: Record<string, unknown> = {};
        for (const name of allImpactedNames) {
          if (Object.prototype.hasOwnProperty.call(cascadeResult.defaultValues, name)) {
            impactedDefaults[name] = cascadeResult.defaultValues[name];
          }
        }

        const mergedFormValues = {
          ...omitValues(currentFormValuesRef.current, allImpactedNames),
          ...impactedDefaults,
        };

        currentFormValuesRef.current = mergedFormValues;
        setFieldGroups(cascadeResult.fieldGroups);
        setDynamicFieldValues(getTriggerFieldValues(mergedFormValues, triggerFieldNames));
        setFormInitialValues(mergedFormValues);
        setExternalDefaultValues(cascadeResult.defaultValues);
        setFormVersion(version => version + 1);
      } catch (error) {
        addErrorMessage(t("Couldn't load options for some fields."));
        Sentry.captureException(error, {
          tags: {
            sentry_app: appName,
            form_element: element,
            form_action: action,
          },
          extra: {
            sentryAppInstallationUuid,
            configUri: config.uri,
            impactedFields: [...allImpactedNames],
          },
        });
      } finally {
        if (requestVersion === dependentFetchVersionRef.current) {
          setIsFetchingDependentFields(false);
        }
      }
    },
    [
      action,
      appName,
      cascadeFetchDependents,
      config.uri,
      element,
      externalDefaultValues,
      fieldGroups,
      sentryAppInstallationUuid,
      triggerFieldNames,
    ]
  );

  const choicesByField = useMemo(() => {
    const lookup: Record<string, Choices> = {};

    for (const field of getAllSchemaFields(fieldGroups)) {
      if (field.type !== 'select') {
        continue;
      }

      // Union initial choices with any search results so label lookup at
      // submit time works for both. asyncOptionsCache only holds the last
      // non-empty search and is never cleared, so spreading it wholesale
      // would shadow initial choices the user might pick after clearing
      // the search input.
      const baseChoices = mergeFieldChoices(field, normalizedResetValues);
      const searchedChoices = asyncOptionsCache[field.name] ?? [];
      const seenValues = new Set<Choice[0]>();
      const merged: Choice[] = [];
      for (const choice of [...baseChoices, ...searchedChoices]) {
        if (!seenValues.has(choice[0])) {
          seenValues.add(choice[0]);
          merged.push(choice);
        }
      }
      lookup[field.name] = merged;
    }

    return lookup;
  }, [asyncOptionsCache, fieldGroups, normalizedResetValues]);

  const submitDisabled = isFetchingDependentFields || isFetchingInitialCascade;

  const {mutateAsync: createExternalIssue} = useMutation<
    unknown,
    Error,
    Record<string, unknown>
  >({
    mutationFn: values =>
      fetchMutation({
        url: `/sentry-app-installations/${sentryAppInstallationUuid}/external-issue-actions/`,
        method: 'POST',
        data: {
          ...normalizedExtraFields,
          ...values,
          action,
          uri: config.uri,
        },
      }),
    onSuccess: response => {
      onSubmitSuccess(response);
    },
    onError: error => {
      if (!(error instanceof RequestError)) {
        addErrorMessage(t('Unable to %s %s issue.', action, appName));
      }
      Sentry.captureException(error, {
        tags: {
          sentry_app: appName,
          form_element: element,
          form_action: action,
        },
        extra: {
          sentryAppInstallationUuid,
          configUri: config.uri,
        },
      });
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

        const payload: AlertRuleSubmitPayload = {
          hasSchemaFormConfig: true,
          sentryAppInstallationUuid,
          settings,
        };
        onSubmitSuccess(payload);
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

  return (
    <BackendJsonSubmitForm
      key={formKey}
      fields={adapterFields}
      initialValues={formInitialValues}
      isLoading={isFetchingInitialCascade}
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
