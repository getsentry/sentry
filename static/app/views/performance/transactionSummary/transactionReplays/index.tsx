import {Alert} from '@sentry/scraps/alert';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {TransactionReplays} from './transactionReplays';

function renderNoAccess() {
  return (
    <Alert.Container>
      <Alert variant="warning" showIcon={false}>
        {t("You don't have access to this feature")}
      </Alert>
    </Alert.Container>
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
