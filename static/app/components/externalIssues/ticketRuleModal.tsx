import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {RequestOptions, ResponseMeta} from 'sentry/api';
import {ExternalLink} from 'sentry/components/core/link';
import {ExternalForm} from 'sentry/components/externalIssues/externalForm';
import {useAsyncOptionsCache} from 'sentry/components/externalIssues/useAsyncOptionsCache';
import {useDynamicFields} from 'sentry/components/externalIssues/useDynamicFields';
import type {ExternalIssueFormErrors} from 'sentry/components/externalIssues/utils';
import {
  getConfigName,
  getFieldProps,
  getOptions,
  hasErrorInFields,
  loadAsyncThenFetchAllFields,
} from 'sentry/components/externalIssues/utils';
import type {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import type {FieldValue} from 'sentry/components/forms/types';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TicketActionData} from 'sentry/types/alerts';
import type {Choices} from 'sentry/types/core';
import type {IntegrationIssueConfig, IssueConfigField} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const IGNORED_FIELDS = ['Sprint'];

interface TicketRuleModalProps extends ModalRenderProps {
  instance: TicketActionData;
  link: string | null;
  onSubmitAction: (
    data: Record<string, string>,
    fetchedFieldOptionsCache: Record<string, Choices>
  ) => void;
  ticketType: string;
}

function makeIntegrationIssueConfigTicketRuleQueryKey({
  orgSlug,
  integrationId,
  query = {},
}: {
  integrationId: string;
  orgSlug: string;
  query?: Record<string, string>;
}): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/integrations/${integrationId}/`,
    {query: {ignored: IGNORED_FIELDS, ...query}},
  ];
}

export default function TicketRuleModal({
  instance,
  link,
  onSubmitAction,
  ticketType,
  closeModal,
  Header,
  Body,
}: TicketRuleModalProps) {
  const action = 'create';
  const title = t('Issue Link Settings');
  const [model] = useState(() => new FormModel());
  const queryClient = useQueryClient();
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  // The instance are values from the saved rule. Once a user modifies the form, we don't want to
  // override any inputs with these instance values.
  const [showInstanceValues, setShowInstanceValues] = useState(true);

  const [hasUpdatedCache, setHasUpdatedCache] = useState(false);
  const [issueConfigFieldsCache, setIssueConfigFieldsCache] = useState<
    IssueConfigField[]
  >(() => {
    return Object.values(instance?.dynamic_form_fields || {});
  });

  const initialOptionsCache = useMemo(() => {
    return Object.fromEntries(
      issueConfigFieldsCache
        .filter(field => field.url)
        .map(field => [field.name, field.choices as Choices])
    );
  }, [issueConfigFieldsCache]);

  const {cache, updateCache} = useAsyncOptionsCache(initialOptionsCache);
  const [isDynamicallyRefetching, setIsDynamicallyRefetching] = useState(false);

  const endpointString = makeIntegrationIssueConfigTicketRuleQueryKey({
    orgSlug: organization.slug,
    integrationId: instance.integration,
  })[0];

  const initialConfigQuery = useMemo(() => {
    return (instance.dynamic_form_fields || [])
      .filter(field => field.updatesForm)
      .filter(field => instance.hasOwnProperty(field.name))
      .reduce(
        (accumulator, {name}) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          accumulator[name] = instance[name];
          return accumulator;
        },
        {action}
      );
  }, [instance]);

  const {
    data: integrationDetails,
    isPending,
    isError,
    error,
  } = useApiQuery<IntegrationIssueConfig>(
    makeIntegrationIssueConfigTicketRuleQueryKey({
      orgSlug: organization.slug,
      integrationId: instance.integration,
      query: initialConfigQuery,
    }),
    {staleTime: Infinity, retry: false, refetchOnMount: 'always'}
  );

  // After the first fetch, update this config cache state
  useEffect(() => {
    if (isPending || !defined(integrationDetails) || hasUpdatedCache) {
      return;
    }
    const newConfigCache = integrationDetails[getConfigName(action)];
    if (newConfigCache) {
      setIssueConfigFieldsCache(newConfigCache);
      setHasUpdatedCache(true);
    }
  }, [isPending, integrationDetails, action, hasUpdatedCache]);

  const {dynamicFieldValues, setDynamicFieldValue} = useDynamicFields({
    action,
    integrationDetails: integrationDetails ?? null,
  });

  const validAndSavableFieldNames = useMemo(() => {
    return issueConfigFieldsCache
      .filter(field => field.hasOwnProperty('name'))
      .map(field => field.name);
  }, [issueConfigFieldsCache]);

  /**
   * XXX: This function seems illegal but it's necessary.
   * The `dynamicFieldValues` are derived from the intial config fetch, see `getDynamicFields`.
   * It starts as an object, with keys of certain field names, and empty values.
   * As the user updates the values, those dynamic fields require a refetch of the config, with what
   * the user entered as a query param. Since we can't conditionally call hooks, we have to avoid
   * `useApiQuery`, and instead manually call the api, and update the cache ourselves.
   */
  const refetchWithDynamicFields = useCallback(
    (dynamicValues: Record<string, FieldValue>) => {
      setIsDynamicallyRefetching(true);
      const requestOptions: RequestOptions = {
        method: 'GET',
        query: {action, ...dynamicValues},
        success: (
          data: IntegrationIssueConfig,
          _textStatus: string | undefined,
          _responseMeta: ResponseMeta | undefined
        ) => {
          setApiQueryData(
            queryClient,
            makeIntegrationIssueConfigTicketRuleQueryKey({
              orgSlug: organization.slug,
              integrationId: instance.integration,
              query: initialConfigQuery,
            }),
            (existingData: IntegrationIssueConfig | undefined) =>
              data ? data : existingData
          );
          setIsDynamicallyRefetching(false);
        },
        error: (err: any) => {
          if (err?.responseText) {
            Sentry.addBreadcrumb({
              message: err.responseText,
              category: 'xhr',
              level: 'error',
            });
          }
          setIsDynamicallyRefetching(false);
        },
      };
      return api.request(endpointString, requestOptions);
    },
    [
      action,
      queryClient,
      organization.slug,
      instance.integration,
      api,
      endpointString,
      initialConfigQuery,
    ]
  );

  /**
   * Clean up the form data before saving it to state.
   */
  const cleanData = useCallback(
    (data: Record<string, string>) => {
      const formData: {
        [key: string]: any;
        integration?: string | number;
      } = {};
      if (instance?.hasOwnProperty('integration')) {
        formData.integration = instance.integration;
      }
      formData.dynamic_form_fields = issueConfigFieldsCache;
      for (const [key, value] of Object.entries(data)) {
        if (validAndSavableFieldNames.includes(key)) {
          formData[key] = value;
        }
      }
      return formData;
    },
    [validAndSavableFieldNames, issueConfigFieldsCache, instance]
  );

  const onFormSubmit = useCallback<Required<FormProps>['onSubmit']>(
    (data, _success, _error, e, modelParam) => {
      // This is a "fake form", so don't actually POST to an endpoint.
      e.preventDefault();
      e.stopPropagation();

      if (modelParam.validateForm()) {
        onSubmitAction(cleanData(data), cache);
        addSuccessMessage(t('Changes applied.'));
        closeModal();
      }
    },
    [cleanData, cache, onSubmitAction, closeModal]
  );

  const onFieldChange = useCallback(
    (fieldName: string, value: FieldValue) => {
      setShowInstanceValues(false);
      if (dynamicFieldValues.hasOwnProperty(fieldName)) {
        setDynamicFieldValue(fieldName, value);
        refetchWithDynamicFields({...dynamicFieldValues, [fieldName]: value});
      }
    },
    [dynamicFieldValues, refetchWithDynamicFields, setDynamicFieldValue]
  );

  // Even if we pass onFieldChange as a prop, the model only uses the first instance.
  // In order to use the correct dynamicFieldValues, we need to set it whenever this function is changed.
  useEffect(() => {
    model.setFormOptions({onFieldChange});
  }, [model, onFieldChange]);

  const getTicketRuleFieldProps = useCallback(
    (field: IssueConfigField) => {
      return getFieldProps({
        field,
        loadOptions: (input: string) =>
          getOptions({
            field,
            input,
            dynamicFieldValues,
            model,
            successCallback: updateCache,
          }),
      });
    },
    [updateCache, dynamicFieldValues, model]
  );

  /**
   * Set the initial data from the Rule, replace `title` and `description` with
   * disabled inputs, and use the cached dynamic choices.
   */
  const cleanFields: IssueConfigField[] = useMemo(() => {
    const fields: IssueConfigField[] = [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'This will be the same as the Sentry Issue.',
        disabled: true,
      } as IssueConfigField,
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        default: 'This will be generated from the Sentry Issue details.',
        disabled: true,
      } as IssueConfigField,
    ];

    const cleanedFields = loadAsyncThenFetchAllFields({
      configName: getConfigName(action),
      integrationDetails: integrationDetails || null,
      fetchedFieldOptionsCache: cache,
    })
      // Don't overwrite the default values for title and description.
      .filter(field => !fields.map(f => f.name).includes(field.name))
      .map(field => {
        // We only need to do the below operation if the form has not been modified.
        if (!showInstanceValues) {
          return field;
        }
        // Overwrite defaults with previously selected values if they exist.
        // Certain fields such as priority (for Jira) have their options change
        // because they depend on another field such as Project, so we need to
        // check if the last selected value is in the list of available field choices.
        const prevChoice = instance?.[field.name];
        // Note that field.choices is an array of tuples, where each tuple
        // contains a numeric id and string label, eg. ("10000", "EX") or ("1", "Bug")

        if (!prevChoice) {
          return field;
        }

        let shouldDefaultChoice = true;

        if (field.choices) {
          shouldDefaultChoice = !!(Array.isArray(prevChoice)
            ? prevChoice.every(value => field.choices?.some(tuple => tuple[0] === value))
            : // Single-select fields have a single value, eg: 'a'
              field.choices?.some(item => item[0] === prevChoice));
        }

        if (shouldDefaultChoice) {
          field.default = prevChoice;
        }

        return field;
      });
    return [...fields, ...cleanedFields];
  }, [instance, integrationDetails, cache, showInstanceValues]);

  const formErrors: ExternalIssueFormErrors = useMemo(() => {
    const errors: ExternalIssueFormErrors = {};
    for (const field of cleanFields) {
      // If the field is a select and has a default value, make sure that the
      // default value exists in the choices. Skip check if the default is not
      // set, an empty string, or an empty array.
      if (
        field.type === 'select' &&
        field.default &&
        !(Array.isArray(field.default) && !field.default.length)
      ) {
        const fieldChoices = (field.choices || []) as Choices;
        const found = fieldChoices.find(([value, _]) =>
          Array.isArray(field.default)
            ? field.default.includes(value)
            : value === field.default
        );

        if (!found) {
          errors[field.name] = (
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            <FieldErrorLabel>{`Could not fetch saved option for ${field.label}. Please reselect.`}</FieldErrorLabel>
          );
        }
      }
    }
    return errors;
  }, [cleanFields]);

  const initialData = useMemo(() => {
    return cleanFields.reduce<Record<string, FieldValue>>(
      (accumulator, field: IssueConfigField) => {
        accumulator[field.name] = field.default;
        return accumulator;
      },
      {}
    );
  }, [cleanFields]);

  const hasFormErrors = useMemo(() => {
    return hasErrorInFields({fields: cleanFields});
  }, [cleanFields]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    const errorDetail = error?.responseJSON?.detail;
    const errorMessage =
      typeof errorDetail === 'string'
        ? errorDetail
        : t('An error occurred loading the issue form');
    return <LoadingError message={errorMessage} />;
  }

  return (
    <ExternalForm
      Header={Header}
      Body={Body}
      formFields={cleanFields}
      errors={formErrors}
      isLoading={isPending || isDynamicallyRefetching}
      formProps={{
        initialData,
        footerClass: 'modal-footer',
        onFieldChange,
        submitDisabled: isPending || hasFormErrors,
        model,
        cancelLabel: t('Close'),
        onCancel: closeModal,
        onSubmit: onFormSubmit,
        submitLabel: t('Apply Changes'),
      }}
      title={title}
      navTabs={null}
      bodyText={
        <BodyText>
          {link
            ? tct(
                'When this alert is triggered [ticketType] will be created with the following fields. It will also [linkToDocs:stay in sync] with the new Sentry Issue.',
                {linkToDocs: <ExternalLink href={link} />, ticketType}
              )
            : tct(
                'When this alert is triggered [ticketType] will be created with the following fields.',
                {ticketType}
              )}
        </BodyText>
      }
      getFieldProps={getTicketRuleFieldProps}
    />
  );
}

const BodyText = styled('div')`
  margin-bottom: ${space(3)};
`;

const FieldErrorLabel = styled('label')`
  padding-bottom: ${space(2)};
  color: ${p => p.theme.tokens.content.danger};
`;
