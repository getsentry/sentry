import {Button, LinkButton} from 'sentry/components/button';
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

export default function AutomationNew() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('New Automation')} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Automations'), to: '/automations'}}>
        <EditLayout>
          <StickyFooter>
            <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
            <Flex gap={space(1)}>
              <Button priority="default">{t('Cancel')}</Button>
              <LinkButton priority="primary" to="/automations/new/settings">
                {t('Next')}
              </LinkButton>
            </Flex>
          </StickyFooter>
        </EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
