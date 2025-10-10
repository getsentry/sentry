import {Alert} from '@sentry/scraps/alert';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: NonNullable<React.ReactNode>;
};

function PullRequestContainer({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['organizations:pr-page']}
      organization={organization}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert.Container>
            <Alert type="warning" showIcon={false}>
              {t("You don't have access to this feature")}
            </Alert>
          </Alert.Container>
        </Layout.Page>
      )}
    >
      <NoProjectMessage organization={organization}>
        <UrlParamBatchProvider>{children}</UrlParamBatchProvider>
      </NoProjectMessage>
    </Feature>
  );
}

export default PullRequestContainer;
