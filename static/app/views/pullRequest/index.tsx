import {Outlet} from 'react-router-dom';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function PullRequestContainer() {
  const organization = useOrganization();

  return (
    <Feature
      features={['organizations:pr-page']}
      organization={organization}
      renderDisabled={() => (
        <Stack flex={1} padding="2xl 3xl">
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              {t("You don't have access to this feature")}
            </Alert>
          </Alert.Container>
        </Stack>
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
