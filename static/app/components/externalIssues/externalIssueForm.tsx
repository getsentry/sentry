import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';
import type {SelectValue} from '@sentry/scraps/select';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import type {RequestOptions} from 'sentry/api';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {useDynamicFields} from 'sentry/components/externalIssues/useDynamicFields';
import type {ExternalIssueAction} from 'sentry/components/externalIssues/utils';
import {getConfigName} from 'sentry/components/externalIssues/utils';
import type {FieldValue} from 'sentry/components/forms/types';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {ResponseMeta} from 'sentry/types/api';
import type {Choice, Choices} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {
  GroupIntegration,
  Integration,
  IntegrationExternalIssue,
  IntegrationIssueConfig,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

export const openExternalIssueModal = ({
  group,
  integration,
  onChange,
  organization,
}: {
  group: Group;
  integration: GroupIntegration;
  onChange: () => void;
  organization: Organization;
}) => {
  trackAnalytics('issue_details.external_issue_modal_opened', {
    organization,
    ...getAnalyticsDataForGroup(group),
    external_issue_provider: integration.provider.key,
    external_issue_type: 'first_party',
  });

  openModal(
    deps => (
      <ExternalIssueForm {...deps} {...{group, onChange, integration, organization}} />
    ),
    {closeEvents: 'escape-key'}
  );
};

const MESSAGES_BY_ACTION = {
  link: t('Successfully linked issue.'),
  create: t('Successfully created issue.'),
};

const SUBMIT_LABEL_BY_ACTION = {
  link: t('Link Issue'),
  create: t('Create Issue'),
};

interface ExternalIssueFormProps extends ModalRenderProps {
  group: Group;
  integration: Integration;
  onChange: () => void;
}

function makeIntegrationIssueConfigQueryKey({
  orgSlug,
  groupId,
  integrationId,
  action,
}: {
  groupId: string;
  integrationId: string;
  orgSlug: string;
  action?: ExternalIssueAction;
}): ApiQueryKey {
  return [
    getApiUrl(
      '/organizations/$organizationIdOrSlug/issues/$issueId/integrations/$integrationId/',
      {
        path: {
          organizationIdOrSlug: orgSlug,
          issueId: groupId,
          integrationId,
        },
      }
    ),
    {query: {action}},
  ];
}

export function ExternalIssueForm({
  group,
  integration,
  onChange,
  closeModal,
  Header,
  Body,
  Footer,
}: ExternalIssueFormProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const {url: endpointString} = parseQueryKey(
    makeIntegrationIssueConfigQueryKey({
      orgSlug: organization.slug,
      groupId: group.id,
      integrationId: integration.id,
    })
  );
  const queryClient = useQueryClient();
  const title = tct('[integration] Issue', {integration: integration.provider.name});

  const [hasTrackedLoad, setHasTrackedLoad] = useState(false);
  const [loadSpan, setLoadSpan] = useState<Span | null>(null);
  const [action, setAction] = useState<ExternalIssueAction>('create');
  const [isDynamicallyRefetching, setIsDynamicallyRefetching] = useState(false);
  // Stable fields don't depend on other fields. We keep the values the user typed
  // so they survive the remounts that dynamic-field refetches cause.
  const [stableFieldValues, setStableFieldValues] = useState<Record<string, FieldValue>>(
    {}
  );
  // The dynamic field that last triggered a refetch, kept so its value survives
  // the remount.
  const [lastChangedField, setLastChangedField] = useState<Record<string, FieldValue>>(
    {}
  );
  // Set of dynamic field names, derived from formFields below.
  const dynamicFieldNamesRef = useRef(new Set<string>());

  const {
    data: integrationDetails,
    error,
    refetch,
    isPending,
    isError,
  } = useApiQuery<IntegrationIssueConfig>(
    makeIntegrationIssueConfigQueryKey({
      orgSlug: organization.slug,
      groupId: group.id,
      integrationId: integration.id,
      action,
    }),
    {
      staleTime: Infinity,
      retry: false,
      refetchOnMount: 'always',
    }
  );
  const {dynamicFieldValues, setDynamicFieldValue} = useDynamicFields({
    action,
    integrationDetails: integrationDetails ?? null,
  });

  const [asyncOptionsCache, setAsyncOptionsCache] = useState<Record<string, Choices>>({});
  const handleAsyncOptionsFetched = useCallback(
    (fieldName: string, options: Array<SelectValue<string>>) => {
      setAsyncOptionsCache(prev => ({
        ...prev,
        [fieldName]: options.map((o): Choice => {
          const label = typeof o.label === 'string' ? o.label : String(o.value);
          return [o.value, label];
        }),
      }));
    },
    []
  );

  /**
   * XXX: This function seems illegal but it's necessary.
   * The `dynamicFieldValues` are derived from the intial config fetch, see `getDynamicFields`.
   * It starts as an object, with keys of certain field names, and empty values.
   * As the user updates the values, those dynamic fields require a refetch of the config, with what
   * the user entered as a query param. Since we can't conditionally call hooks, we have to avoid
   * `useApiQuery`, and instead manually call the api, and update the cache ourselves.
   */
  const refetchWithDynamicFields = useCallback(
    (dynamicValues: Record<string, unknown>) => {
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
            makeIntegrationIssueConfigQueryKey({
              orgSlug: organization.slug,
              groupId: group.id,
              integrationId: integration.id,
              action,
            }),
            existingData => (data ? data : existingData)
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
      group.id,
      integration.id,
      api,
      endpointString,
    ]
  );

  const startSpan = useCallback(
    (type: 'load' | 'submit') => {
      return Sentry.withScope(scope => {
        scope.setTag('issueAction', action);
        scope.setTag('groupID', group.id);
        scope.setTag('projectID', group.project.id);
        scope.setTag('integrationSlug', integration.provider.slug);
        scope.setTag('integrationType', 'firstParty');
        return Sentry.startInactiveSpan({
          name: `externalIssueForm.${type}`,
          forceTransaction: true,
        });
      });
    },
    [action, group.id, group.project.id, integration.provider.slug]
  );

  // Start the span for the load request
  useEffect(() => {
    const span = startSpan('load');
    setLoadSpan(span);
    return () => {
      span?.end();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // End the span for the load request
  useEffect(() => {
    if (!isPending && !hasTrackedLoad) {
      loadSpan?.end();
      trackAnalytics('issue_details.external_issue_loaded', {
        organization,
        ...getAnalyticsDataForGroup(group),
        external_issue_provider: integration.provider.key,
        external_issue_type: 'first_party',
        success: !isError,
      });
      setHasTrackedLoad(true);
    }
  }, [isPending, isError, loadSpan, organization, group, integration, hasTrackedLoad]);

  const handleClick = (newAction: ExternalIssueAction) => {
    setAction(newAction);
    // Reset preserved field values when switching tabs — create and link forms
    // are independent, and stale values from one should not bleed into the other.
    setStableFieldValues({});
    setLastChangedField({});
    refetch();
  };

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const span = startSpan('submit');
      try {
        const data: IntegrationExternalIssue = await api.requestPromise(endpointString, {
          method: action === 'create' ? 'POST' : 'PUT',
          data: values,
        });
        trackAnalytics('issue_details.external_issue_created', {
          organization,
          ...getAnalyticsDataForGroup(group),
          external_issue_provider: integration.provider.key,
          external_issue_type: 'first_party',
        });
        addSuccessMessage(MESSAGES_BY_ACTION[action]);
        onChange();
        closeModal();
        span?.end();
        return data;
      } catch (err) {
        span?.end();
        throw err;
      }
    },
    [
      api,
      endpointString,
      action,
      organization,
      group,
      integration,
      startSpan,
      closeModal,
      onChange,
    ]
  );

  const handleValueChange = useCallback(
    (fieldName: string, value: unknown) => {
      // If the changed field isn't dynamic, save its value.
      if (!dynamicFieldNamesRef.current.has(fieldName)) {
        setStableFieldValues(prev => ({...prev, [fieldName]: value}));
      }
    },
    [] // dynamicFieldNamesRef.current is kept current via useMemo below
  );

  const onFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      if (Object.hasOwn(dynamicFieldValues, fieldName)) {
        setLastChangedField({[fieldName]: value});
        setDynamicFieldValue(fieldName, value);
        refetchWithDynamicFields({
          ...dynamicFieldValues,
          [fieldName]: value,
        });
      }
    },
    [dynamicFieldValues, refetchWithDynamicFields, setDynamicFieldValue]
  );

  const formFields = useMemo((): JsonFormAdapterFieldConfig[] => {
    if (!integrationDetails) {
      return [];
    }
    const config = integrationDetails[getConfigName(action)];
    return (config ?? []).map(field => {
      const cachedChoices = asyncOptionsCache[field.name];
      if (field.url && cachedChoices) {
        const existingValues = new Set((field.choices ?? []).map(c => String(c[0])));
        const missingChoices = cachedChoices.filter(
          c => !existingValues.has(String(c[0]))
        );
        if (missingChoices.length > 0) {
          return {
            ...field,
            choices: [...(field.choices ?? []), ...missingChoices],
          };
        }
      }
      return field;
    }) as JsonFormAdapterFieldConfig[];
  }, [integrationDetails, action, asyncOptionsCache]);

  // Build the set of dynamic field names from the current config.
  dynamicFieldNamesRef.current = useMemo(
    () => new Set(formFields.filter(f => f.updatesForm).map(f => f.name)),
    [formFields]
  );

  const hasFormErrors = formFields.some(
    field => field.name === 'error' && field.type === 'blank'
  );

  // Key changes when field config changes, forcing the form to remount with fresh defaults.
  // Includes field names and defaults so the form resets even when only defaults change.
  const formKey = useMemo(
    () => formFields.map(f => `${f.name}:${JSON.stringify(f.default)}`).join(','),
    [formFields]
  );

  if (isPending) {
    return (
      <Fragment>
        <Header closeButton>
          <Heading as="h4">{title}</Heading>
        </Header>
        <Body>
          <LoadingIndicator />
        </Body>
      </Fragment>
    );
  }

  if (isError) {
    const errorDetail = error?.responseJSON?.detail;
    const errorMessage =
      typeof errorDetail === 'string'
        ? errorDetail
        : t('An error occurred loading the issue form');
    return (
      <Fragment>
        <Header closeButton>
          <Heading as="h4">{title}</Heading>
        </Header>
        <Body>
          <LoadingError message={errorMessage} />
        </Body>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{title}</Heading>
      </Header>
      <Container marginBottom="xl">
        <Tabs value={action} onChange={handleClick}>
          <TabList>
            <TabList.Item key="create">{t('Create')}</TabList.Item>
            <TabList.Item key="link">{t('Link')}</TabList.Item>
          </TabList>
        </Tabs>
      </Container>
      <Body>
        <BackendJsonSubmitForm
          key={formKey}
          fields={formFields}
          initialValues={{...stableFieldValues, ...lastChangedField}}
          onSubmit={handleSubmit}
          submitLabel={SUBMIT_LABEL_BY_ACTION[action]}
          isLoading={isDynamicallyRefetching}
          dynamicFieldValues={dynamicFieldValues}
          onAsyncOptionsFetched={handleAsyncOptionsFetched}
          onFieldChange={onFieldChange}
          onValueChange={handleValueChange}
          submitDisabled={hasFormErrors}
          footer={({SubmitButton, disabled}) => (
            <Footer>
              <SubmitButton disabled={disabled}>
                {SUBMIT_LABEL_BY_ACTION[action]}
              </SubmitButton>
            </Footer>
          )}
        />
      </Body>
    </Fragment>
  );
}
