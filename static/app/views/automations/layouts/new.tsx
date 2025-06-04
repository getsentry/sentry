import {useState} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

export default function NewAutomationLayout({children}: {children: React.ReactNode}) {
  const organization = useOrganization();
  const [title, setTitle] = useState(t('New Automation'));
  return (
    <SentryDocumentTitle title={title} noSuffix>
      <BreadcrumbsProvider
        crumb={{
          label: t('Automations'),
          to: makeAutomationBasePathname(organization.slug),
        }}
      >
        <EditLayout onTitleChange={value => setTitle(value)}>{children}</EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
