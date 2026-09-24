import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {FieldValue} from 'sentry/components/forms/model';
import {FormModel} from 'sentry/components/forms/model';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {FullHeightFormDeprecated} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  type DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {
  createCondition,
  AutomationBuilderContext,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {AutomationForm} from 'sentry/views/automations/components/automationForm';
import type {AutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {
  assignSubfilterIds,
  getAutomationFormData,
  getNewAutomationData,
  validateAutomationBuilderState,
} from 'sentry/views/automations/components/automationFormData';
import {EditableAutomationName} from 'sentry/views/automations/components/editableAutomationName';
import {EditAutomationActions} from 'sentry/views/automations/components/editAutomationActions';
import {getAutomationAnalyticsPayload} from 'sentry/views/automations/components/forms/common/getAutomationAnalyticsPayload';
import {AutomationFormProvider} from 'sentry/views/automations/components/forms/context';
import {useAutomationQuery, useUpdateAutomation} from 'sentry/views/automations/hooks';
import {useAutomationBuilderErrors} from 'sentry/views/automations/hooks/useAutomationBuilderErrors';
import {
  makeAutomationBasePathname,
  makeAutomationDetailsPathname,
} from 'sentry/views/automations/pathnames';
import {dataConditionGroupToLLMContext} from 'sentry/views/automations/utils/automationLLMContext';
import {resolveDetectorIdsForProjects} from 'sentry/views/automations/utils/resolveDetectorIdsForProjects';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

function AutomationDocumentTitle() {
  const title = useFormField('name');
  return <SentryDocumentTitle title={title ?? t('Edit Alert')} />;
}

const CONTEXT_HINT =
  'Sentry alert edit page. These are the live builder values, which may differ from the saved ' +
  'alert — the user is mid-edit and has not submitted. Answer questions about the alert from ' +
  'these values, not from a fetched copy. triggers is the condition group that starts the alert; ' +
  'actionFilters are the groups that gate each set of actions, and every action reports where it ' +
  'lands — targetDisplay is the resolved channel, team, or user name. validationErrors is empty ' +
  'until a submit fails validation.';

function AlertBuilderNodeInner({
  automationId,
  state,
  validationErrors,
}: {
  automationId: string;
  state: AutomationBuilderState;
  validationErrors: Record<string, any>;
}) {
  // Every field here is set by `getAutomationFormData`, so unlike the monitor
  // builder — where each detector type declares a different set — none of them
  // can be missing from the form.
  const unsavedValues = {
    name: useFormField<string>('name'),
    environment: useFormField<string>('environment'),
    frequency: useFormField<number>('frequency'),
    detectorIds: useFormField<string[]>('detectorIds'),
    projectIds: useFormField<string[]>('projectIds'),
  };

  useLLMContext({
    // Outranks the page nodes beneath it, so an alert being edited wins.
    priority: 1,
    contextHint: CONTEXT_HINT,
    mode: 'editing',
    id: automationId,
    unsavedValues,
    // Read from the reducer, not the fetched alert: the builder seeds itself
    // from the saved copy and then diverges as the user edits.
    triggers: dataConditionGroupToLLMContext(state.triggers),
    actionFilters: state.actionFilters.map(dataConditionGroupToLLMContext),
    validationErrors,
  });

  return null;
}

/**
 * Reports the alert being edited. Renders nothing.
 *
 * Must render beneath the form, since that is what `useFormField` resolves
 * against — a hook in the component that *renders* the form sees none of it.
 */
const AlertBuilderNode = registerLLMContext('alert-builder', AlertBuilderNodeInner);

function AutomationBreadcrumbs() {
  const organization = useOrganization();
  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: t('Alerts'),
              to: makeAutomationBasePathname(organization.slug),
            },
          ]}
        />
      </TopBar.Slot>

      <TopBar.Slot name="title">
        <EditableAutomationName />
      </TopBar.Slot>
    </Fragment>
  );
}

export default function AutomationEdit() {
  const params = useParams<{automationId: string}>();

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
  const queryClient = useQueryClient();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.lg;
  const initialData = useMemo((): Record<string, FieldValue> | undefined => {
    if (!automation) {
      return undefined;
    }
    return getAutomationFormData(automation);
  }, [automation]);

  const initialState = useMemo(() => getInitialState(automation), [automation]);

  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer(initialState);

  const {
    errors: automationBuilderErrors,
    setErrors: setAutomationBuilderErrors,
    removeError,
  } = useAutomationBuilderErrors();

  const {mutateAsync: updateAutomation, error} = useUpdateAutomation();

  const handleFormSubmit = useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, _event, formModel) => {
      const automationFormData = data as AutomationFormData;
      const errors = validateAutomationBuilderState(state, automationFormData);
      setAutomationBuilderErrors(errors);

      if (Object.keys(errors).length > 0) {
        const analyticsPayload = getAutomationAnalyticsPayload(
          getNewAutomationData({
            data: automationFormData,
            state,
          })
        );
        Sentry.logger.warn('Edit alert form validation failed', {
          errors,
          details: analyticsPayload,
        });
        trackAnalytics('automation.updated', {
          organization,
          ...analyticsPayload,
          success: false,
        });
        return;
      }

      formModel.setFormSaving();

      const formData = await resolveDetectorIdsForProjects({
        formData: automationFormData,
        onSubmitError,
        organization,
        projectIds: data.projectIds,
        queryClient,
      });
      if (!formData) {
        return;
      }
      const newAutomationData = getNewAutomationData({
        data: formData,
        state,
      });
      const analyticsPayload = getAutomationAnalyticsPayload(newAutomationData);

      try {
        const updatedAutomation = await updateAutomation({
          id: automation.id,
          ...newAutomationData,
        });
        onSubmitSuccess(formModel?.getData() ?? data);
        addSuccessMessage(t('Alert updated'));
        trackAnalytics('automation.updated', {
          organization,
          ...analyticsPayload,
          success: true,
        });
        navigate(makeAutomationDetailsPathname(organization.slug, updatedAutomation.id));
      } catch (e) {
        Sentry.logger.warn('Edit alert request failure', {
          error: e,
          details: analyticsPayload,
        });
        trackAnalytics('automation.updated', {
          organization,
          ...analyticsPayload,
          success: false,
        });
        onSubmitError?.(e);
      }
    },
    [
      state,
      setAutomationBuilderErrors,
      automation.id,
      updateAutomation,
      organization,
      navigate,
      queryClient,
    ]
  );

  return (
    <FullHeightFormDeprecated
      hideFooter
      model={model}
      initialData={initialData}
      onSubmit={handleFormSubmit}
    >
      <AutomationFormProvider automation={automation}>
        <AlertBuilderNode
          automationId={automation.id}
          state={state}
          validationErrors={automationBuilderErrors}
        />
        <AutomationDocumentTitle />
        <Stack flex={1}>
          <AutomationBreadcrumbs />
          <AutomationFeedbackButton />
          <Layout.Body maxWidth={maxWidth}>
            <Layout.Main width="full">
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
        </Stack>
        <StickyFooter>
          <Flex
            width="100%"
            maxWidth={`calc(${maxWidth} - ${theme.space.xl} - ${theme.space.xl})`}
            align="center"
            gap="md"
            justify="end"
          >
            <EditAutomationActions automation={automation} form={model} />
          </Flex>
        </StickyFooter>
      </AutomationFormProvider>
    </FullHeightFormDeprecated>
  );
}

function getInitialState(automation: Automation): AutomationBuilderState | undefined {
  if (!automation) {
    return undefined;
  }

  return {
    triggers: getInitialTriggers(automation.triggers),
    actionFilters: assignSubfilterIds(automation.actionFilters),
  };
}

function getInitialTriggers(triggers: DataConditionGroup | null): DataConditionGroup {
  if (!triggers) {
    return {
      id: 'when',
      logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
      conditions: [createCondition(DataConditionType.EVERY_EVENT)],
    };
  }

  if (triggers.conditions.length === 0) {
    return {
      ...triggers,
      conditions: [createCondition(DataConditionType.EVERY_EVENT)],
    };
  }

  return triggers;
}
