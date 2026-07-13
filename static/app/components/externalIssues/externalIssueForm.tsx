import {useCallback, useEffect, useEffectEvent, useMemo, useRef, useState} from 'react';
import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import type {SelectValue} from '@sentry/scraps/select';
import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {useDynamicFields} from 'sentry/components/externalIssues/useDynamicFields';
import type {ExternalIssueAction} from 'sentry/components/externalIssues/utils';
import {getConfigName} from 'sentry/components/externalIssues/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
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

function startExternalIssueFormSpan({
  action,
  group,
  integration,
  type,
}: {
  action: ExternalIssueAction;
  group: Group;
  integration: Integration;
  type: 'load' | 'submit';
}): Span {
  return Sentry.withScope(scope => {
    scope.setTag('issueAction', action);
    scope.setTag('groupID', group.id);
    scope.setTag('projectID', group.project.id);
    scope.setTag('integrationSlug', integration.provider.slug);
    scope.setTag('integrationType', 'firstParty');
    scope.setAttributes({
      issueAction: action,
      groupID: group.id,
      projectID: group.project.id,
      integrationSlug: integration.provider.slug,
      integrationType: 'firstParty',
    });
    return Sentry.startInactiveSpan({
      name: `externalIssueForm.${type}`,
      forceTransaction: true,
    });
  });
}

export function ExternalIssueForm({
  group,
  integration,
  onChange,
  closeModal,
  CloseButton,
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

  const [hasTrackedLoad, setHasTrackedLoad] = useState(false);
  const loadSpanRef = useRef<Span | null>(null);
  const [action, setAction] = useState<ExternalIssueAction>('create');
  const title = tct('[action] [integration] Issue', {
    action: action === 'create' ? t('Create') : t('Link'),
    integration: integration.provider.name,
  });
  const [isDynamicallyRefetching, setIsDynamicallyRefetching] = useState(false);
  const {
    data: integrationDetails,
    error,
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
    async (dynamicValues: Record<string, unknown>) => {
      setIsDynamicallyRefetching(true);
      try {
        const [data] = await api.requestPromise(endpointString, {
          method: 'GET',
          query: {action, ...dynamicValues},
          includeAllArgs: true,
        });
        setApiQueryData(
          queryClient,
          makeIntegrationIssueConfigQueryKey({
            orgSlug: organization.slug,
            groupId: group.id,
            integrationId: integration.id,
            action,
          }),
          existingData => (data ? (data as IntegrationIssueConfig) : existingData)
        );
      } catch (err: any) {
        if (err?.responseText) {
          Sentry.addBreadcrumb({
            message: err.responseText,
            category: 'xhr',
            level: 'error',
          });
        }
      } finally {
        setIsDynamicallyRefetching(false);
      }
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

  const startLoadSpan = useEffectEvent(() => {
    loadSpanRef.current = startExternalIssueFormSpan({
      action,
      group,
      integration,
      type: 'load',
    });
  });

  // Start the span for the load request
  useEffect(() => {
    startLoadSpan();
    return () => {
      loadSpanRef.current?.end();
      loadSpanRef.current = null;
    };
  }, []);

  // End the span for the load request
  useEffect(() => {
    if (!isPending && !hasTrackedLoad) {
      loadSpanRef.current?.end();
      loadSpanRef.current = null;
      trackAnalytics('issue_details.external_issue_loaded', {
        organization,
        ...getAnalyticsDataForGroup(group),
        external_issue_provider: integration.provider.key,
        external_issue_type: 'first_party',
        success: !isError,
      });
      setHasTrackedLoad(true);
    }
  }, [isPending, isError, organization, group, integration, hasTrackedLoad]);

  const handleClick = (newAction: ExternalIssueAction) => {
    setAction(newAction);
  };

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const span = startExternalIssueFormSpan({
        action,
        group,
        integration,
        type: 'submit',
      });
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
    [api, endpointString, action, organization, group, integration, closeModal, onChange]
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

  const onFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      if (Object.hasOwn(dynamicFieldValues, fieldName)) {
        setDynamicFieldValue(fieldName, value);
        refetchWithDynamicFields({
          ...dynamicFieldValues,
          [fieldName]: value,
        });
      }
    },
    [dynamicFieldValues, refetchWithDynamicFields, setDynamicFieldValue]
  );

  const hasFormErrors = formFields.some(
    field => field.name === 'error' && field.type === 'blank'
  );

  const errorDetail = error?.responseJSON?.detail;
  const errorMessage =
    typeof errorDetail === 'string'
      ? errorDetail
      : t('An error occurred loading the issue form');

  return (
    <Stack gap="xl">
      <Grid
        as="header"
        columns="minmax(0, 1fr) max-content"
        areas={`"content close" "content loading"`}
        align="start"
        gap="0 md"
        borderBottom="primary"
      >
        <Stack area="content" align="stretch" gap="lg" minWidth={0}>
          <Heading as="h2">{title}</Heading>
          <Tabs value={action} onChange={handleClick} disableOverflow>
            <TabList>
              <TabList.Item key="create">{t('Create')}</TabList.Item>
              <TabList.Item key="link">{t('Link')}</TabList.Item>
            </TabList>
          </Tabs>
        </Stack>
        <Container area="close" justifySelf="center">
          <CloseButton />
        </Container>
        <Container area="loading" display="flex" justifySelf="center" minHeight="20px">
          {isDynamicallyRefetching && <LoadingIndicator size={20} style={{margin: 0}} />}
        </Container>
      </Grid>
      <Body>
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError message={errorMessage} />
        ) : (
          <BackendJsonSubmitForm
            key={action}
            fields={formFields}
            onSubmit={handleSubmit}
            submitLabel={SUBMIT_LABEL_BY_ACTION[action]}
            disabled={isDynamicallyRefetching}
            dynamicFieldValues={dynamicFieldValues}
            onAsyncOptionsFetched={handleAsyncOptionsFetched}
            onFieldChange={onFieldChange}
            submitDisabled={hasFormErrors}
            footer={({SubmitButton, disabled}) => (
              <Footer>
                <Flex align="center" gap="md">
                  {isDynamicallyRefetching && (
                    <LoadingIndicator size={20} style={{margin: 0}} />
                  )}
                  <SubmitButton disabled={disabled}>
                    {SUBMIT_LABEL_BY_ACTION[action]}
                  </SubmitButton>
                </Flex>
              </Footer>
            )}
          />
        )}
      </Body>
    </Stack>
  );
}
