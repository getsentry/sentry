import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactChildren;
  organization: Organization;
};

function renderNoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

const BetaGracePeriodAlertHook = HookOrDefault({
  hookName: 'component:replay-beta-grace-period-alert',
});

function ReplaysContainer({organization, children}: Props) {
  return (
    <Feature
      features={['session-replay-ui']}
      organization={organization}
      renderDisabled={renderNoAccess}
    >
      <Feature
        features={['session-replay-beta-grace']}
        organization={organization}
        renderDisabled={false}
      >
        <BetaGracePeriodAlertHook organization={organization} />
      </Feature>
      {children}
    </Feature>
  );
}

export default withOrganization(ReplaysContainer);
