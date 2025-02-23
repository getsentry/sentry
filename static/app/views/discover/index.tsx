import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  children: React.ReactNode;
  organization: Organization;
};

function DiscoverContainer({organization, children}: Props) {
  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/discover/',
    newPathPrefix: '/explore/discover/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  function renderNoAccess() {
    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  return (
    <Feature
      features="discover-basic"
      organization={organization}
      hookName="feature-disabled:discover2-page"
      renderDisabled={renderNoAccess}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );
}

export default withOrganization(DiscoverContainer);
