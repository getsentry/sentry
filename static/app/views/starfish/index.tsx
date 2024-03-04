import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactNode;
};

const queryClient = new QueryClient();

function StarfishContainer({children}: Props) {
  const organization = useOrganization();

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

export default StarfishContainer;
