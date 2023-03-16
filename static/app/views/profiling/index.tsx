import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactChildren;
};

function ProfilingContainer({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      hookName="feature-disabled:profiling-page"
      features={['profiling']}
      organization={organization}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Layout.Page>
      )}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );
}

export default ProfilingContainer;
