import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';

export default function NewDetectorLayout({children}: {children: React.ReactNode}) {
  return (
    <SentryDocumentTitle title={t('New Monitor')} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Monitors'), to: '/issues/monitors'}}>
        <EditLayout>{children}</EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
