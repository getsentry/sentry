import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import TransactionReplays from './transactionReplays';

function renderNoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

function TransactionReplaysContainer() {
  const organization = useOrganization();

  return (
    <Feature
      features="session-replay"
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <TransactionReplays />
    </Feature>
  );
}

export default TransactionReplaysContainer;
