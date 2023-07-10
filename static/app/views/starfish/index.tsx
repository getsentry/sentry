import {useEffect} from 'react';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactChildren;
  organization: Organization;
};

const queryClient = new QueryClient();

function StarfishContainer({organization, children}: Props) {
  const location = useLocation();
  const router = useRouter();
  const {slug} = organization;
  const projectId =
    slug === 'sentry' ? '1' : slug === 'peated' ? '4504120414765056' : null;
  useEffect(() => {
    if (projectId && location.query.project !== projectId) {
      router.replace({
        pathname: location.pathname,
        query: {...location.query, project: projectId},
      });
    }
  }, [location.pathname, location.query, projectId, router]);

  return (
    <Feature
      hookName="feature-disabled:starfish-view"
      features={['starfish-view']}
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
