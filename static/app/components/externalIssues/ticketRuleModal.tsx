import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {ExternalLink} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {RequestOptions, ResponseMeta} from 'sentry/api';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {useDynamicFields} from 'sentry/components/externalIssues/useDynamicFields';
import {getConfigName} from 'sentry/components/externalIssues/utils';
import type {FieldValue} from 'sentry/components/forms/types';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {TicketActionData} from 'sentry/types/alerts';
import type {Choices, SelectValue} from 'sentry/types/core';
import type {IntegrationIssueConfig, IssueConfigField} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

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
    getApiUrl('/organizations/$organizationIdOrSlug/integrations/$integrationId/', {
      path: {
        organizationIdOrSlug: orgSlug,
        integrationId,
      },
    }),
    {query: {ignored: IGNORED_FIELDS, ...query}},
  ];
}

export function TicketRuleModal({
  instance,
  link,
  onSubmitAction,
  ticketType,
  closeModal,
  Header,
  Body,
  Footer,
}: TicketRuleModalProps) {
  const action = 'create';
  const title = t('Issue Link Settings');
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

  const [isDynamicallyRefetching, setIsDynamicallyRefetching] = useState(false);

  // Track async select options fetched via search so they can be persisted
  // in the rule config when the form is submitted.
  const [asyncOptionsCache, setAsyncOptionsCache] = useState<Record<string, Choices>>({});
  const handleAsyncOptionsFetched = useCallback(
    (fieldName: string, options: Array<SelectValue<string | number>>) => {
      setAsyncOptionsCache(prev => ({
        ...prev,
        [fieldName]: options.map(
          o =>
            [o.value, typeof o.label === 'string' ? o.label : String(o.value)] as [
              string | number,
              string,
            ]
        ),
      }));
    },
    []
  );

  const {url: endpointString} = parseQueryKey(
    makeIntegrationIssueConfigTicketRuleQueryKey({
      orgSlug: organization.slug,
      integrationId: instance.integration,
    })
  );

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
    (data: Record<string, unknown>) => {
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

  const handleSubmit = useCallback(
    (values: Record<string, unknown>) => {
      // Build a cache of field choices so the parent can persist them.
      // Start with static choices from the config, then overlay search results
      // captured via onAsyncOptionsFetched.
      const fieldOptionsCache: Record<string, Choices> = {};
      const config = integrationDetails?.[getConfigName(action)] || [];
      for (const field of config) {
        if (field.url && field.choices) {
          fieldOptionsCache[field.name] = field.choices as Choices;
        }
      }
      // Merge async search results (overwrites static choices for the same field)
      for (const [fieldName, choices] of Object.entries(asyncOptionsCache)) {
        fieldOptionsCache[fieldName] = choices;
      }

      onSubmitAction(cleanData(values) as Record<string, string>, fieldOptionsCache);
      addSuccessMessage(t('Changes applied.'));
      closeModal();
    },
    [cleanData, onSubmitAction, closeModal, integrationDetails, asyncOptionsCache]
  );

  const [lastChangedField, setLastChangedField] = useState<Record<string, unknown>>({});

  const onFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      setShowInstanceValues(false);
      if (dynamicFieldValues.hasOwnProperty(fieldName)) {
        setLastChangedField({[fieldName]: value});
        setDynamicFieldValue(fieldName, value as FieldValue);
        refetchWithDynamicFields({
          ...dynamicFieldValues,
          [fieldName]: value as FieldValue,
        });
      }
    },
    [dynamicFieldValues, refetchWithDynamicFields, setDynamicFieldValue]
  );

  /**
   * Set the initial data from the Rule, replace `title` and `description` with
   * disabled inputs, and use the cached dynamic choices.
   */
  const cleanFields = useMemo((): JsonFormAdapterFieldConfig[] => {
    const staticFields: JsonFormAdapterFieldConfig[] = [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'This will be the same as the Sentry Issue.',
        disabled: true,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        default: 'This will be generated from the Sentry Issue details.',
        disabled: true,
      },
    ];

    // Build a map of saved choices from instance.dynamic_form_fields so we can
    // restore async select options that were previously fetched via search.
    const savedFields = Object.values(instance?.dynamic_form_fields || {});
    const savedChoicesMap = new Map(
      savedFields
        .filter(
          (f): f is IssueConfigField =>
            typeof f === 'object' &&
            f !== null &&
            'url' in f &&
            'choices' in f &&
            Array.isArray(f.choices) &&
            f.choices.length > 0
        )
        .map(f => [f.name, f.choices as Choices])
    );

    const configFields = (integrationDetails?.[getConfigName(action)] ||
      []) as JsonFormAdapterFieldConfig[];

    const cleanedFields = configFields
      // Don't overwrite the default values for title and description.
      .filter(field => !staticFields.some(f => f.name === field.name))
      .map(field => {
        // We only need to do the below operation if the form has not been modified.
        if (!showInstanceValues) {
          return field;
        }
        // Overwrite defaults with previously selected values if they exist.
        const prevChoice = instance?.[field.name];

        if (!prevChoice) {
          return field;
        }

        let shouldDefaultChoice = true;

        if (field.type === 'select' || field.type === 'choice') {
          // For async select fields, always trust the saved value — choices
          // are fetched dynamically and won't be in the static choices list.
          if ('url' in field && field.url) {
            shouldDefaultChoice = true;
          } else {
            const choices = field.choices || [];
            shouldDefaultChoice = !!(Array.isArray(prevChoice)
              ? prevChoice.every(value => choices.some(tuple => tuple[0] === value))
              : choices.some(item => item[0] === prevChoice));
          }
        }

        if (shouldDefaultChoice) {
          // For async fields, also restore saved choices so the select can
          // display the label for the saved value.
          const savedChoices = savedChoicesMap.get(field.name);
          if (savedChoices && 'url' in field && field.url) {
            return {
              ...field,
              default: prevChoice,
              choices: savedChoices as Array<[string, string]>,
            };
          }
          return {...field, default: prevChoice};
        }

        return field;
      });
    return [...staticFields, ...cleanedFields];
  }, [instance, integrationDetails, showInstanceValues]);

  const formErrors = useMemo(() => {
    const errors: Record<string, React.ReactNode> = {};
    for (const field of cleanFields) {
      if (
        (field.type === 'select' || field.type === 'choice') &&
        field.default &&
        !(Array.isArray(field.default) && !field.default.length)
      ) {
        // Skip validation for async select fields — their choices are
        // fetched dynamically and won't contain the saved value until searched.
        if ('url' in field && field.url) {
          continue;
        }
        const fieldChoices = (field.choices || []) as Choices;
        const found = fieldChoices.find(([value, _]) =>
          Array.isArray(field.default)
            ? (field.default as unknown[]).includes(value)
            : value === field.default
        );

        if (!found) {
          errors[field.name] = (
            <FieldErrorLabel>{`Could not fetch saved option for ${field.label}. Please reselect.`}</FieldErrorLabel>
          );
        }
      }
    }
    return errors;
  }, [cleanFields]);

  const hasFormErrors = useMemo(() => {
    return cleanFields.some(field => field.name === 'error' && field.type === 'blank');
  }, [cleanFields]);

  // Key changes when field config changes, forcing the form to remount with fresh defaults.
  // Includes field names and defaults so the form resets even when only defaults change.
  const formKey = useMemo(
    () => cleanFields.map(f => `${f.name}:${JSON.stringify(f.default)}`).join(','),
    [cleanFields]
  );

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
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{title}</Heading>
      </Header>
      <Body>
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
        {Object.entries(formErrors).map(([name, errorNode]) => (
          <Fragment key={name}>{errorNode}</Fragment>
        ))}
        <BackendJsonSubmitForm
          key={formKey}
          fields={cleanFields}
          onSubmit={handleSubmit}
          initialValues={lastChangedField}
          submitLabel={t('Apply Changes')}
          submitDisabled={hasFormErrors}
          isLoading={isDynamicallyRefetching}
          dynamicFieldValues={dynamicFieldValues}
          onAsyncOptionsFetched={handleAsyncOptionsFetched}
          onFieldChange={onFieldChange}
          footer={({SubmitButton, disabled}) => (
            <Footer>
              <SubmitButton disabled={disabled}>{t('Apply Changes')}</SubmitButton>
            </Footer>
          )}
        />
      </Body>
    </Fragment>
  );
}

const BodyText = styled('div')`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const FieldErrorLabel = styled('label')`
  padding-bottom: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.danger};
`;
