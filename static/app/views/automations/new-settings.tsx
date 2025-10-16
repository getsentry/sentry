import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import FormModel from 'sentry/components/forms/model';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
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
import {useCreateAutomation} from 'sentry/views/automations/hooks';
import {
  makeAutomationBasePathname,
  makeAutomationDetailsPathname,
} from 'sentry/views/automations/pathnames';

function AutomationDocumentTitle() {
  const title = useFormField('name');
  return (
    <SentryDocumentTitle
      title={title ? t('%s - New Automation', title) : t('New Automation')}
    />
  );
}

function AutomationBreadcrumbs() {
  const title = useFormField('name');
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Automation'), to: makeAutomationBasePathname(organization.slug)},
        {label: title ? title : t('New Automation')},
      ]}
    />
  );
}

const initialData = {
  name: 'New Automation',
  environment: null,
  frequency: 1440,
  enabled: true,
};

export default function AutomationNewSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer();

  const [automationBuilderErrors, setAutomationBuilderErrors] = useState<
    Record<string, string>
  >({});
  const removeError = useCallback((errorId: string) => {
    setAutomationBuilderErrors(prev => {
      const {[errorId]: _removedError, ...remainingErrors} = prev;
      return remainingErrors;
    });
  }, []);

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
    async (data, _, __, ___, ____) => {
      const errors = validateAutomationBuilderState(state);
      setAutomationBuilderErrors(errors);

      if (Object.keys(errors).length === 0) {
        const automation = await createAutomation(
          getNewAutomationData(data as AutomationFormData, state)
        );
        navigate(makeAutomationDetailsPathname(organization.slug, automation.id));
      }
    },
    [createAutomation, state, navigate, organization.slug]
  );

  return (
    <FullHeightForm
      hideFooter
      initialData={{...initialData, detectorIds: initialConnectedIds}}
      onSubmit={handleSubmit}
      model={model}
    >
      <AutomationDocumentTitle />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <AutomationBreadcrumbs />
            <Layout.Title>
              <EditableAutomationName />
            </Layout.Title>
          </Layout.HeaderContent>
          <AutomationFeedbackButton />
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
                  showTriggerLogicTypeSelector: false,
                }}
              >
                <AutomationForm model={model} />
              </AutomationBuilderContext.Provider>
            </AutomationBuilderErrorContext.Provider>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <Text variant="muted" size="md">
          {t('Step 2 of 2')}
        </Text>
        <Flex gap="md">
          <LinkButton
            priority="default"
            to={`${makeAutomationBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          <Button priority="primary" type="submit">
            {t('Create Automation')}
          </Button>
        </Flex>
      </StickyFooter>
    </FullHeightForm>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
