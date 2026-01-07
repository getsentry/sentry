import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react-lite';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import FormModel from 'sentry/components/forms/model';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AutomationBuilderContext,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {AutomationFeedbackButton} from 'sentry/views/automations/components/automationFeedbackButton';
import AutomationForm from 'sentry/views/automations/components/automationForm';
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

function AutomationDocumentTitle() {
  const title = useFormField('name');
  return (
    <SentryDocumentTitle title={title ? t('%s - New Alert', title) : t('New Alert')} />
  );
}

function AutomationBreadcrumbs() {
  const title = useFormField('name');
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Alerts'),
          to: makeAutomationBasePathname(organization.slug),
        },
        {label: title ? title : t('New Alert')},
      ]}
    />
  );
}

const initialData = {
  name: '',
  environment: null,
  frequency: 1440,
  enabled: true,
  projectIds: [],
};

export default function AutomationNewSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.lg;

  const {
    errors: automationBuilderErrors,
    setErrors: setAutomationBuilderErrors,
    removeError,
  } = useAutomationBuilderErrors();

  const initialConnectedIds = useMemo(() => {
    const connectedIdsQuery = location.query.connectedIds as
      | string
      | string[]
      | undefined;
    if (!connectedIdsQuery) {
      return [];
    }
    const connectedIds = Array.isArray(connectedIdsQuery)
      ? connectedIdsQuery
      : [connectedIdsQuery];
    return connectedIds;
  }, [location.query.connectedIds]);

  const {mutateAsync: createAutomation, error} = useCreateAutomation();

  const handleSubmit = useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, _event, formModel) => {
      const errors = validateAutomationBuilderState(state);
      setAutomationBuilderErrors(errors);
      const newAutomationData = getNewAutomationData(data as AutomationFormData, state);

      if (Object.keys(errors).length === 0) {
        try {
          formModel.setFormSaving();
          const automation = await createAutomation(newAutomationData);
          onSubmitSuccess(formModel.getData());
          trackAnalytics('automation.created', {
            organization,
            ...getAutomationAnalyticsPayload(newAutomationData),
            source: 'full',
            success: true,
          });
          navigate(makeAutomationDetailsPathname(organization.slug, automation.id));
        } catch (err) {
          onSubmitError(err);
          trackAnalytics('automation.created', {
            organization,
            ...getAutomationAnalyticsPayload(newAutomationData),
            source: 'full',
            success: false,
          });
        }
      } else {
        trackAnalytics('automation.created', {
          organization,
          ...getAutomationAnalyticsPayload(newAutomationData),
          source: 'full',
          success: false,
        });
      }
    },
    [createAutomation, state, navigate, organization, setAutomationBuilderErrors]
  );

  return (
    <FullHeightForm
      hideFooter
      initialData={{...initialData, detectorIds: initialConnectedIds}}
      onSubmit={handleSubmit}
      model={model}
    >
      <AutomationFormProvider>
        <AutomationDocumentTitle />
        <Layout.Page>
          <StyledLayoutHeader>
            <HeaderInner maxWidth={maxWidth}>
              <Layout.HeaderContent>
                <AutomationBreadcrumbs />
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
                    showTriggerLogicTypeSelector: false,
                  }}
                >
                  <AutomationForm model={model} />
                </AutomationBuilderContext.Provider>
              </AutomationBuilderErrorContext.Provider>
            </Layout.Main>
          </StyledBody>
        </Layout.Page>
        <StickyFooter>
          <Flex style={{maxWidth}} align="center" gap="md" justify="end">
            <Observer>
              {() => (
                <Button priority="primary" type="submit" disabled={model.isSaving}>
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
