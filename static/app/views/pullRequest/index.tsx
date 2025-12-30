import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useOrganization from 'sentry/utils/useOrganization';

export default function PullRequestContainer() {
  const organization = useOrganization();

  return (
    <Feature
      features={['organizations:pr-page']}
      organization={organization}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              {t("You don't have access to this feature")}
            </Alert>
          </Alert.Container>
        </Layout.Page>
      )}
    >
      <NoProjectMessage organization={organization}>
        <UrlParamBatchProvider>
          <Outlet />
        </UrlParamBatchProvider>
      </NoProjectMessage>
    </Feature>
  );
}
