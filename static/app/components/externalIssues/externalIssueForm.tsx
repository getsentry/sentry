import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {RequestOptions, ResponseMeta} from 'sentry/api';
import type {ExternalIssueAction} from 'sentry/components/externalIssues/abstractExternalIssueForm';
import {ExternalForm} from 'sentry/components/externalIssues/externalForm';
import {useAsyncOptionsCache} from 'sentry/components/externalIssues/useAsyncOptionsCache';
import {
  getConfigName,
  getDynamicFields,
  getFieldProps,
  getOptions,
  hasErrorInFields,
  loadAsyncThenFetchAllFields,
} from 'sentry/components/externalIssues/utils';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {
  Integration,
  IntegrationExternalIssue,
  IntegrationIssueConfig,
  IssueConfigField,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

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
  onChange: (onSuccess?: () => void, onError?: () => void) => void;
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
    `/organizations/${orgSlug}/issues/${groupId}/integrations/${integrationId}/`,
    {query: {action}},
  ];
}

export default function ExternalIssueForm({
  group,
  integration,
  onChange,
  closeModal,
  Header,
  Body,
}: ExternalIssueFormProps) {
  const api = useApi({persistInFlight: true});
  const [model] = useState(() => new FormModel());
  const organization = useOrganization();
  const endpointString = makeIntegrationIssueConfigQueryKey({
    orgSlug: organization.slug,
    groupId: group.id,
    integrationId: integration.id,
  })[0];
  const queryClient = useQueryClient();
  const title = tct('[integration] Issue', {integration: integration.provider.name});

  const [hasTrackedLoad, setHasTrackedLoad] = useState(false);
  const [loadSpan, setLoadSpan] = useState<Span | null>(null);
  const [submitSpan, setSubmitSpan] = useState<Span | null>(null);
  const [action, setAction] = useState<ExternalIssueAction>('create');
  const {cache, updateCache} = useAsyncOptionsCache();
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
    }
  );

  const dynamicFieldValues = useMemo(
    () => getDynamicFields({action, integrationDetails}),
    [action, integrationDetails]
  );

  /**
   * XXX: This function seems illegal but it's necessary.
   * The `dynamicFieldValues` are derived from the intial config fetch, see `getDynamicFields`.
   * It starts as an object, with keys of certain field names, and empty values.
   * As the user updates the values, those dynamic fields require a refetch of the config, with what
   * the user entered as a query param. Since we can't conditionally call hooks, we have to avoid
   * `useApiQuery`, and instead manually call the api, and update the cache ourselves.
   */
  const refetchWithDynamicFields = useCallback(() => {
    setIsDynamicallyRefetching(true);
    const requestOptions: RequestOptions = {
      method: 'GET',
      query: {action, ...dynamicFieldValues},
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
        // This behavior comes from the DeprecatedAsyncComponent
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
  }, [
    action,
    dynamicFieldValues,
    queryClient,
    organization.slug,
    group.id,
    integration.id,
    api,
    endpointString,
  ]);

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

  const handlePreSubmit = useCallback(() => {
    setSubmitSpan(startSpan('submit'));
  }, [startSpan]);

  const handleSubmitError = useCallback(() => {
    submitSpan?.end();
  }, [submitSpan]);

  const handleSubmitSuccess = useCallback(
    (_data: IntegrationExternalIssue) => {
      trackAnalytics('issue_details.external_issue_created', {
        organization,
        ...getAnalyticsDataForGroup(group),
        external_issue_provider: integration.provider.key,
        external_issue_type: 'first_party',
      });
      onChange(() => addSuccessMessage(MESSAGES_BY_ACTION[action]));
      closeModal();
      submitSpan?.end();
    },
    [organization, group, integration, submitSpan, action, closeModal, onChange]
  );

  const onFieldChange = useCallback(
    (fieldName: string, _value: FieldValue) => {
      if (dynamicFieldValues.hasOwnProperty(fieldName)) {
        refetchWithDynamicFields();
      }
    },
    [refetchWithDynamicFields, dynamicFieldValues]
  );

  const getExternalIssueFieldProps = useCallback(
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

  const formFields = useMemo(() => {
    if (!integrationDetails) {
      return [];
    }
    return loadAsyncThenFetchAllFields({
      configName: getConfigName(action),
      integrationDetails,
      fetchedFieldOptionsCache: cache,
    });
  }, [integrationDetails, action, cache]);

  const initialData = formFields.reduce<Record<string, FieldValue>>(
    (accumulator, field: IssueConfigField) => {
      accumulator[field.name] = field.default;
      return accumulator;
    },
    {}
  );

  const hasFormErrors = useMemo(() => {
    return hasErrorInFields({fields: formFields});
  }, [formFields]);

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
      formFields={formFields}
      isLoading={isPending || isDynamicallyRefetching}
      formProps={{
        initialData,
        onFieldChange,
        model,
        footerClass: 'modal-footer',
        submitDisabled: isPending || hasFormErrors,
        submitLabel: SUBMIT_LABEL_BY_ACTION[action],
        apiEndpoint: endpointString,
        apiMethod: action === 'create' ? 'POST' : 'PUT',
        onPreSubmit: handlePreSubmit,
        onSubmitError: handleSubmitError,
        onSubmitSuccess: handleSubmitSuccess,
      }}
      title={title}
      navTabs={
        <NavTabs underlined>
          <li className={action === 'create' ? 'active' : ''}>
            <a onClick={() => handleClick('create')}>{t('Create')}</a>
          </li>
          <li className={action === 'link' ? 'active' : ''}>
            <a onClick={() => handleClick('link')}>{t('Link')}</a>
          </li>
        </NavTabs>
      }
      bodyText={null}
      getFieldProps={getExternalIssueFieldProps}
    />
  );
}
