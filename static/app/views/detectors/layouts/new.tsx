import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function NewDetectorLayout({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const title = useFormField<string>('title');

  return (
    <SentryDocumentTitle title={title || t('New Monitor')}>
      <BreadcrumbsProvider
        crumb={{label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)}}
      >
        <EditLayout>{children}</EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
