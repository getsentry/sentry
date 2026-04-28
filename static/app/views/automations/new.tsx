import {useCallback, Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';
import orderBy from 'lodash/orderBy';
import {Observer} from 'mobx-react-lite';
import {parseAsNativeArrayOf, parseAsString, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FormModel} from 'sentry/components/forms/model';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  AutomationBuilderContext,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import {AutomationForm} from 'sentry/views/automations/components/automationForm';
import type {AutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {
  getNewAutomationData,
  validateAutomationBuilderState,
} from 'sentry/views/automations/components/automationFormData';
import {EditableAutomationName} from 'sentry/views/automations/components/editableAutomationName';
import {getAutomationAnalyticsPayload} from 'sentry/views/automations/components/forms/common/getAutomationAnalyticsPayload';
import {AutomationFormProvider} from 'sentry/views/automations/components/forms/context';
import {useCreateAutomation} from 'sentry/views/automations/hooks';
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
  return (
    <SentryDocumentTitle title={title ? t('%s - New Alert', title) : t('New Alert')} />
  );
}

function AutomationBreadcrumbs() {
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
        {label: hasPageFrameFeature ? t('New Alert') : title || t('New Alert')},
      ]}
    />
  );
}

const INITIAL_FORM_DATA_DEFAULTS = {
  name: '',
  environment: null,
  frequency: 0,
  enabled: true,
  projectIds: [],
  detectorIds: [],
};

function useInitialFormData() {
  const {selection} = usePageFilters();
  const [connectedIds] = useQueryState(
    'connectedIds',
    parseAsNativeArrayOf(parseAsString)
  );
  const [projectId] = useQueryState('project', parseAsString);
  const {projects} = useProjects();

  // If URL params are passed, use them
  if (connectedIds.length > 0) {
    return {
      ...INITIAL_FORM_DATA_DEFAULTS,
      detectorIds: connectedIds,
    };
  }
  if (projectId) {
    return {
      ...INITIAL_FORM_DATA_DEFAULTS,
      projectIds: [projectId],
    };
  }

  // If any specific projects are selected, use the first one
  const intitialSelectedProject = selection.projects.find(p => p > 0);
  if (intitialSelectedProject) {
    return {
      ...INITIAL_FORM_DATA_DEFAULTS,
      projectIds: [String(intitialSelectedProject)],
    };
  }

  // Otherwise use the first project that the user has access to
  const sortedUserProjects = orderBy(
    projects,
    ['isMember', 'isBookmarked'],
    ['desc', 'desc']
  );
  const firstUserProject = sortedUserProjects[0];
  return {
    ...INITIAL_FORM_DATA_DEFAULTS,
    projectIds: firstUserProject ? [firstUserProject.id] : [],
  };
}

export default function AutomationNewSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.lg;
  const hasPageFrameFeature = useHasPageFrameFeature();
  const initialData = useInitialFormData();

  const {
    errors: automationBuilderErrors,
    setErrors: setAutomationBuilderErrors,
    removeError,
  } = useAutomationBuilderErrors();

  const {mutateAsync: createAutomation, error} = useCreateAutomation();

  const handleSubmit = useCallback<OnSubmitCallback>(
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
        Sentry.logger.warn('Create alert form validation failed', {
          errors,
          details: analyticsPayload,
        });
        trackAnalytics('automation.created', {
          organization,
          ...analyticsPayload,
          source: 'full',
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
        const automation = await createAutomation(newAutomationData);
        onSubmitSuccess(formModel.getData());
        addSuccessMessage(t('Alert created'));
        trackAnalytics('automation.created', {
          organization,
          ...analyticsPayload,
          source: 'full',
          success: true,
        });
        navigate(makeAutomationDetailsPathname(organization.slug, automation.id));
      } catch (err) {
        onSubmitError(err);
        Sentry.logger.warn('Create alert request failure', {
          error: err,
          details: analyticsPayload,
        });
        trackAnalytics('automation.created', {
          organization,
          ...analyticsPayload,
          source: 'full',
          success: false,
        });
      }
    },
    [
      state,
      setAutomationBuilderErrors,
      organization,
      queryClient,
      createAutomation,
      navigate,
    ]
  );

  return (
    <FullHeightForm
      hideFooter
      initialData={initialData}
      onSubmit={handleSubmit}
      model={model}
    >
      <AutomationFormProvider>
        <AutomationDocumentTitle />
        <Stack flex={1}>
          <Layout.Header {...(hasPageFrameFeature ? {} : {background: 'primary'})}>
            <HeaderInner maxWidth={maxWidth}>
              <Layout.HeaderContent>
                {hasPageFrameFeature ? (
                  <Fragment>
                    <TopBar.Slot name="title">
                      <AutomationBreadcrumbs />
                    </TopBar.Slot>
                    <Heading as="h1" ellipsis>
                      <EditableAutomationName />
                    </Heading>
                  </Fragment>
                ) : (
                  <Fragment>
                    <AutomationBreadcrumbs />
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
                    showTriggerLogicTypeSelector: false,
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
            <Observer>
              {() => (
                <Button priority="primary" type="submit" busy={model.isSaving}>
                  {t('Create Alert')}
                </Button>
              )}
            </Observer>
          </Flex>
        </StickyFooter>
      </AutomationFormProvider>
    </FullHeightForm>
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
