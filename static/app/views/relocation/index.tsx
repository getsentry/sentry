import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';

import RelocationOnboarding from './relocation';

export default function RelocationOnboardingContainer() {
  return (
    <Feature
      features={['relocation:enabled']}
      organizationAllowNull
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
      <RelocationOnboarding />
    </Feature>
  );
}
