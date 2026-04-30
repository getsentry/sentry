import {Fragment, useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
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
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {
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
import {resolveDetectorIdsForProjects} from 'sentry/views/automations/utils/resolveDetectorIdsForProjects';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

function AutomationDocumentTitle() {
  const title = useFormField('name');
  return <SentryDocumentTitle title={title ?? t('Edit Alert')} />;
}

function AutomationBreadcrumbs({
  automationId,
  automationName,
}: {
  automationId: string;
  automationName: string;
}) {
  const title = useFormField('name');
  const organization = useOrganization();
  const hasPageFrameFeature = useHasPageFrameFeature();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Alerts'),
          to: makeAutomationBasePathname(organization.slug),
        },
        {
          label: hasPageFrameFeature ? automationName : title,
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
  const queryClient = useQueryClient();
  const params = useParams<{automationId: string}>();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.lg;
  const hasPageFrameFeature = useHasPageFrameFeature();

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
        <AutomationDocumentTitle />
        <Stack flex={1}>
          <Layout.Header {...(hasPageFrameFeature ? {} : {background: 'primary'})}>
            <HeaderInner maxWidth={maxWidth}>
              <Layout.HeaderContent>
                {hasPageFrameFeature ? (
                  <Fragment>
                    <TopBar.Slot name="title">
                      <AutomationBreadcrumbs
                        automationId={params.automationId}
                        automationName={automation.name}
                      />
                    </TopBar.Slot>
                    <Heading as="h1" ellipsis>
                      <EditableAutomationName />
                    </Heading>
                  </Fragment>
                ) : (
                  <Fragment>
                    <AutomationBreadcrumbs
                      automationId={params.automationId}
                      automationName={automation.name}
                    />
                    <Layout.Title>
                      <EditableAutomationName />
                    </Layout.Title>
                  </Fragment>
                )}
              </Layout.HeaderContent>
              <div>
                <AutomationFeedbackButton />
              </div>
            </HeaderInner>
          </Layout.Header>
          <Layout.Body
            maxWidth={maxWidth}
            margin={hasPageFrameFeature ? '0' : {sm: 'xl', md: '2xl 3xl'}}
            {...(hasPageFrameFeature ? {} : {padding: '0'})}
          >
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
            maxWidth={
              // Layout.Body uses `lg xl` page-frame padding, so subtract the left/right `xl`
              // gutters to align the footer actions with the inner content column.
              hasPageFrameFeature
                ? `calc(${maxWidth} - ${theme.space.xl} - ${theme.space.xl})`
                : maxWidth
            }
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

const HeaderInner = styled('div')<{maxWidth?: string}>`
  display: contents;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    max-width: ${p => p.maxWidth};
    width: 100%;
  }
`;
