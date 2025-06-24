import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: NonNullable<React.ReactNode>;
};

function PreprodContainer({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['organizations:preprod-frontend-routes']}
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

export default PreprodContainer;
