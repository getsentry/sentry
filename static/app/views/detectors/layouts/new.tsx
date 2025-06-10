import {useCallback, useContext} from 'react';

import FormContext from 'sentry/components/forms/formContext';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useFormField} from 'sentry/components/workflowEngine/form/hooks';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function NewDetectorLayout({children}: {children: React.ReactNode}) {
  const formContext = useContext(FormContext);
  const organization = useOrganization();
  const title = useFormField<string>('name') ?? 'New Monitor';

  const onTitleChange = useCallback(
    (value: string) => {
      formContext.form?.setValue('name', value);
    },
    [formContext.form]
  );

  return (
    <SentryDocumentTitle title={title}>
      <BreadcrumbsProvider
        crumb={{label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)}}
      >
        <EditLayout onTitleChange={onTitleChange} title={title}>
          {children}
        </EditLayout>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}
