import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {TabList, Tabs} from '@sentry/scraps/tabs';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal, type ModalRenderProps} from 'sentry/actionCreators/modal';
import type {RequestOptions, ResponseMeta} from 'sentry/api';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {useDynamicFields} from 'sentry/components/externalIssues/useDynamicFields';
import type {ExternalIssueAction} from 'sentry/components/externalIssues/utils';
import {getConfigName} from 'sentry/components/externalIssues/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
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
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
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

  const handleClick = useCallback(
    (newAction: ExternalIssueAction) => {
      setAction(newAction);
      refetch();
    },
    [refetch]
  );

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

  // Track the field that triggered the last dynamic refetch so we can
  // preserve its value when the form remounts with new config.
  const [lastChangedField, setLastChangedField] = useState<Record<string, unknown>>({});

  const onFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      if (dynamicFieldValues.hasOwnProperty(fieldName)) {
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
    return (config ?? []) as JsonFormAdapterFieldConfig[];
  }, [integrationDetails, action]);

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
      <TabsContainer>
        <Tabs value={action} onChange={handleClick}>
          <TabList>
            <TabList.Item key="create">{t('Create')}</TabList.Item>
            <TabList.Item key="link">{t('Link')}</TabList.Item>
          </TabList>
        </Tabs>
      </TabsContainer>
      <Body>
        <BackendJsonSubmitForm
          key={formKey}
          fields={formFields}
          initialValues={lastChangedField}
          onSubmit={handleSubmit}
          submitLabel={SUBMIT_LABEL_BY_ACTION[action]}
          isLoading={isDynamicallyRefetching}
          dynamicFieldValues={dynamicFieldValues}
          onFieldChange={onFieldChange}
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

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;
