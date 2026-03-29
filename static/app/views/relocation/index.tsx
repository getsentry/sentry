import {Alert} from '@sentry/scraps/alert';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';

import {RelocationOnboarding} from './relocation';

export default function RelocationOnboardingContainer() {
  return (
    <Feature
      features={['relocation:enabled']}
      organizationAllowNull
      renderDisabled={() => (
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              {t("You don't have access to this feature")}
            </Alert>
          </Alert.Container>
      )}
    >
      <RelocationOnboarding />
    </Feature>
  );
}
