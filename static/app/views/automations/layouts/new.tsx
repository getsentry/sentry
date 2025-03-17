import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';

export default function NewAutomationLayout({children}: {children: React.ReactNode}) {
  return (
    <SentryDocumentTitle title={t('New Automation')} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Automations'), to: '/automations/'}}>
        <EditLayout>{children}</EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
