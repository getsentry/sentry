import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import GroupReplays from './groupReplays';

type Props = {
  group: Group;
};

const GroupReplaysContainer = (props: Props) => {
  const organization = useOrganization();
  function renderNoAccess() {
    return (
      <Layout.Page withPadding>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
    );
  }

  return (
    <Feature
      features={['session-replay-ui']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <GroupReplays {...props} />
    </Feature>
  );
};

export default GroupReplaysContainer;
