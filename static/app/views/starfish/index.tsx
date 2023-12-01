import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  organization: Organization;
};

const queryClient = new QueryClient();

function StarfishContainer({organization, children}: Props) {
  return (
    <Feature
      hookName="feature-disabled:starfish-view"
      features="starfish-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NoProjectMessage>
    </Feature>
  );
}

function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

export default withOrganization(StarfishContainer);
