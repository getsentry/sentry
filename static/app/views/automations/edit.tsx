import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Flex} from 'sentry/components/core/layout';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {Automation, NewAutomation} from 'sentry/types/workflowEngine/automations';
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {
  AutomationBuilderContext,
  initialAutomationBuilderState,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import AutomationForm from 'sentry/views/automations/components/automationForm';
import type {AutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {
  getAutomationFormData,
  getNewAutomationData,
  validateAutomationBuilderState,
} from 'sentry/views/automations/components/automationFormData';
import {EditableAutomationName} from 'sentry/views/automations/components/editableAutomationName';
import {EditAutomationActions} from 'sentry/views/automations/components/editAutomationActions';
import {useAutomationQuery, useUpdateAutomation} from 'sentry/views/automations/hooks';
import {
  makeAutomationBasePathname,
  makeAutomationDetailsPathname,
} from 'sentry/views/automations/pathnames';

function AutomationDocumentTitle() {
  const title = useFormField('name');
  return <SentryDocumentTitle title={title ?? t('Edit Automation')} />;
}

function AutomationBreadcrumbs({automationId}: {automationId: string}) {
  const title = useFormField('name');
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Automation'), to: makeAutomationBasePathname(organization.slug)},
        {
          label: title,
          to: makeAutomationDetailsPathname(organization.slug, automationId),
        },
        {label: t('Configure')},
      ]}
    />
  );
}

export default function AutomationEdit() {
  const params = useParams<{automationId: string}>();

  useWorkflowEngineFeatureGate({redirect: true});

  const {
    data: automation,
    isPending,
    isError,
    refetch,
  } = useAutomationQuery(params.automationId);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !automation) {
    return <LoadingError onRetry={refetch} />;
  }

  return <AutomationEditForm automation={automation} />;
}

function AutomationEditForm({automation}: {automation: Automation}) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const params = useParams<{automationId: string}>();

  const initialData = useMemo((): Record<string, FieldValue> | undefined => {
    if (!automation) {
      return undefined;
    }
    return getAutomationFormData(automation);
  }, [automation]);

  const initialState = useMemo((): AutomationBuilderState | undefined => {
    if (!automation) {
      return undefined;
    }
    return {
      triggers: automation.triggers
        ? automation.triggers
        : initialAutomationBuilderState.triggers,
      actionFilters: automation.actionFilters,
    };
  }, [automation]);

  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer(initialState);

  const [automationBuilderErrors, setAutomationBuilderErrors] = useState<
    Record<string, string>
  >({});

  const {mutateAsync: updateAutomation, error} = useUpdateAutomation();

  const removeError = useCallback((errorId: string) => {
    setAutomationBuilderErrors(prev => {
      const {[errorId]: _removedError, ...remainingErrors} = prev;
      return remainingErrors;
    });
  }, []);

  const handleFormSubmit = useCallback<OnSubmitCallback>(
    async (data, _, __, ___, ____) => {
      const errors = validateAutomationBuilderState(state);
      setAutomationBuilderErrors(errors);

      if (Object.keys(errors).length === 0) {
        const formData: NewAutomation = getNewAutomationData(
          data as AutomationFormData,
          state
        );
        const updatedData = {
          id: automation.id,
          ...formData,
        };
        const updatedAutomation = await updateAutomation(updatedData);
        navigate(makeAutomationDetailsPathname(organization.slug, updatedAutomation.id));
      }
    },
    [automation.id, organization.slug, navigate, updateAutomation, state]
  );

  return (
    <FullHeightForm
      hideFooter
      model={model}
      initialData={initialData}
      onSubmit={handleFormSubmit}
    >
      <AutomationDocumentTitle />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <AutomationBreadcrumbs automationId={params.automationId} />
            <Layout.Title>
              <EditableAutomationName />
            </Layout.Title>
          </Layout.HeaderContent>
          <Flex>
            <EditAutomationActions automation={automation} />
          </Flex>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <AutomationBuilderErrorContext.Provider
              value={{
                errors: automationBuilderErrors,
                setErrors: setAutomationBuilderErrors,
                removeError,
                mutationErrors: error?.responseJSON,
              }}
            >
              <AutomationBuilderContext.Provider
                value={{
                  state,
                  actions,
                  showTriggerLogicTypeSelector:
                    state.triggers.logicType === DataConditionGroupLogicType.ALL,
                }}
              >
                <AutomationForm model={model} />
              </AutomationBuilderContext.Provider>
            </AutomationBuilderErrorContext.Provider>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </FullHeightForm>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
