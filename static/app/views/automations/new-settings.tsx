import {Button, LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import NewAutomationLayout from 'sentry/views/automations/layouts/new';

export default function AutomationNewSettings() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <NewAutomationLayout>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to="/automations/new/">
            {t('Back')}
          </LinkButton>
          <Button priority="primary">{t('Create Automation')}</Button>
        </Flex>
      </StickyFooter>
    </NewAutomationLayout>
  );
}
