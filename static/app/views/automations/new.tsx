import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import NewAutomationLayout from 'sentry/views/automations/layouts/new';

export default function AutomationNew() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <NewAutomationLayout>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to="/issues/automations">
            {t('Cancel')}
          </LinkButton>
          <LinkButton priority="primary" to="/issues/automations/new/settings">
            {t('Next')}
          </LinkButton>
        </Flex>
      </StickyFooter>
    </NewAutomationLayout>
  );
}
