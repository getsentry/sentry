import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {AlertProcedure} from 'sentry/views/alerts/blueprints/types';

function AlertProcedureEditor() {
  const organization = useOrganization();
  const router = useRouter();
  const {procedureId = 'new'} = router.params;

  const {data: procedure = {} as AlertProcedure, isLoading} = useApiQuery<AlertProcedure>(
    [`/organizations/${organization.slug}/alert-procedures/${procedureId}/`],
    {staleTime: 0}
  );

  const pageTitle =
    procedureId === 'new' && !isLoading
      ? 'New Alert Procedure'
      : `Editing '${procedure.label}'`;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Alert Procedure')} orgSlug={organization.slug} />
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{pageTitle}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>testing</Layout.Body>
    </Fragment>
  );
}

export default AlertProcedureEditor;
