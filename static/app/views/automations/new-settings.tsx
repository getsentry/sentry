import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function AutomationNewSettings() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('New Automation')} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Automations'), to: '/automations'}}>
        <EditLayout>
          <StickyFooter>
            <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
            <Flex gap={space(1)}>
              <Button priority="default">{t('Cancel')}</Button>
              <Button priority="primary">{t('Create Automation')}</Button>
            </Flex>
          </StickyFooter>
        </EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
