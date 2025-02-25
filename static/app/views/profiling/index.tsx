import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

const profilingFeature = ['profiling'];

type Props = {
  children: React.ReactNode;
};

function ProfilingContainer({children}: Props) {
  const organization = useOrganization();

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/profiling/',
    newPathPrefix: '/explore/profiling/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <Feature
      hookName="feature-disabled:profiling-page"
      features={profilingFeature}
      organization={organization}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert.Container>
            <Alert type="warning">{t("You don't have access to this feature")}</Alert>
          </Alert.Container>
        </Layout.Page>
      )}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );
}

export default ProfilingContainer;
