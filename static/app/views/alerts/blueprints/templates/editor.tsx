import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {AlertTemplate} from 'sentry/views/alerts/blueprints/types';

function AlertTemplateEditor() {
  const organization = useOrganization();
  const router = useRouter();
  const {templateId = 'new'} = router.params;

  const {data: template = {} as AlertTemplate, isLoading} = useApiQuery<AlertTemplate>(
    [`/organizations/${organization.slug}/alert-templates/${templateId}/`],
    {staleTime: 0}
  );

  const pageTitle =
    templateId === 'new' && !isLoading
      ? 'New Alert Template'
      : `Editing '${template.name}'`;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Alert Template')} orgSlug={organization.slug} />
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{pageTitle}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>testing</Layout.Body>
    </Fragment>
  );
}

export default AlertTemplateEditor;
