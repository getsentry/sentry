import {useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
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
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {t} from 'sentry/locale';
import type {Automation, NewAutomation} from 'sentry/types/workflowEngine/automations';
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {
  AutomationBuilderContext,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import AutomationForm from 'sentry/views/automations/components/automationForm';
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
import {
  makeAutomationBasePathname,
  makeAutomationDetailsPathname,
} from 'sentry/views/automations/pathnames';

function AutomationDocumentTitle() {
  const title = useFormField('name');
  return <SentryDocumentTitle title={title ?? t('Edit Alert')} />;
}

function AutomationBreadcrumbs({automationId}: {automationId: string}) {
  const title = useFormField('name');
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Alerts'),
          to: makeAutomationBasePathname(organization.slug),
        },
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
  const theme = useTheme();
  const maxWidth = theme.breakpoints.lg;

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
        : {
            id: 'when',
            logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
            conditions: [],
          },
      actionFilters: assignSubfilterIds(automation.actionFilters),
    };
  }, [automation]);

  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer(initialState);

  const [automationBuilderErrors, setAutomationBuilderErrors] = useState<
    Record<string, any>
  >({});

  const {mutateAsync: updateAutomation, error} = useUpdateAutomation();

  const removeError = useCallback((errorId: string) => {
    setAutomationBuilderErrors(prev => {
      const {[errorId]: _removedError, ...remainingErrors} = prev;
      return remainingErrors;
    });
  }, []);

  const handleFormSubmit = useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, _event, formModel) => {
      const errors = validateAutomationBuilderState(state);
      setAutomationBuilderErrors(errors);

      if (Object.keys(errors).length === 0) {
        try {
          formModel.setFormSaving();
          const formData: NewAutomation = getNewAutomationData(
            data as AutomationFormData,
            state
          );
          const updatedData = {
            id: automation.id,
            ...formData,
          };
          const updatedAutomation = await updateAutomation(updatedData);
          onSubmitSuccess(formModel?.getData() ?? data);
          trackAnalytics('automation.updated', {
            organization,
            ...getAutomationAnalyticsPayload(updatedAutomation),
          });
          navigate(
            makeAutomationDetailsPathname(organization.slug, updatedAutomation.id)
          );
        } catch (err) {
          onSubmitError?.(err);
        }
      }
    },
    [automation.id, organization, navigate, updateAutomation, state]
  );

  return (
    <FullHeightForm
      hideFooter
      model={model}
      initialData={initialData}
      onSubmit={handleFormSubmit}
    >
      <AutomationFormProvider automation={automation}>
        <AutomationDocumentTitle />
        <Layout.Page>
          <StyledLayoutHeader>
            <HeaderInner maxWidth={maxWidth}>
              <Layout.HeaderContent>
                <AutomationBreadcrumbs automationId={params.automationId} />
                <Layout.Title>
                  <EditableAutomationName />
                </Layout.Title>
              </Layout.HeaderContent>
              <div>
                <AutomationFeedbackButton />
              </div>
            </HeaderInner>
          </StyledLayoutHeader>
          <StyledBody maxWidth={maxWidth}>
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
          </StyledBody>
        </Layout.Page>
        <StickyFooter>
          <Flex maxWidth={maxWidth} align="center" gap="md" justify="end">
            <EditAutomationActions automation={automation} form={model} />
          </Flex>
        </StickyFooter>
      </AutomationFormProvider>
    </FullHeightForm>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.tokens.background.primary};
`;

const HeaderInner = styled('div')<{maxWidth?: string}>`
  display: contents;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    max-width: ${p => p.maxWidth};
    width: 100%;
  }
`;

const StyledBody = styled(Layout.Body)<{maxWidth?: string}>`
  max-width: ${p => p.maxWidth};
  padding: 0;
  margin: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: 0;
    margin: ${p =>
      p.noRowGap
        ? `${p.theme.space.xl} ${p.theme.space['3xl']}`
        : `${p.theme.space['2xl']} ${p.theme.space['3xl']}`};
  }
`;
