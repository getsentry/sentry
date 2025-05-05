import {useState} from 'react';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';

export default function NewDetectorLayout({children}: {children: React.ReactNode}) {
  const [title, setTitle] = useState(t('New Monitor'));
  return (
    <SentryDocumentTitle title={title} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Monitors'), to: '/issues/monitors'}}>
        <EditLayout onTitleChange={value => setTitle(value)}>{children}</EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
