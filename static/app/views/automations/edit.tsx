import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {AutomationBuilderState} from 'sentry/views/automations/components/automationBuilderContext';
import {
  AutomationBuilderContext,
  initialAutomationBuilderState,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import AutomationForm from 'sentry/views/automations/components/automationForm';
import {getAutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {EditableAutomationName} from 'sentry/views/automations/components/editableAutomationName';
import {useAutomationQuery} from 'sentry/views/automations/hooks';
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
  const organization = useOrganization();
  const params = useParams<{automationId: string}>();

  useWorkflowEngineFeatureGate({redirect: true});

  const {
    data: automation,
    isPending,
    isError,
    refetch,
  } = useAutomationQuery(params.automationId);

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

  if (isPending && !initialData) {
    return <LoadingIndicator />;
  }

  if (isError || !automation || !initialData) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <FullHeightForm hideFooter model={model} initialData={initialData}>
      <AutomationDocumentTitle />
      <Layout.Page>
        <StyledLayoutHeader>
          <Layout.HeaderContent>
            <AutomationBreadcrumbs automationId={params.automationId} />
            <Layout.Title>
              <EditableAutomationName />
            </Layout.Title>
          </Layout.HeaderContent>
        </StyledLayoutHeader>
        <Layout.Body>
          <Layout.Main fullWidth>
            <AutomationBuilderContext.Provider value={{state, actions}}>
              <AutomationForm model={model} />
            </AutomationBuilderContext.Provider>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton
            priority="default"
            to={makeAutomationDetailsPathname(organization.slug, params.automationId)}
          >
            {t('Cancel')}
          </LinkButton>
          <Button priority="primary" type="submit">
            {t('Save')}
          </Button>
        </Flex>
      </StickyFooter>
    </FullHeightForm>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;
