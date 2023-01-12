import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactChildren;
  organization: Organization;
};

function ReplaysContainer({organization, children}: Props) {
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
      {children}
    </Feature>
  );
}

export default withOrganization(ReplaysContainer);
