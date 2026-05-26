import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {TransactionReplays} from './transactionReplays';

function renderNoAccess() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    </Stack>
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
