import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';

import RelocationOnboarding from './relocation';

type Props = RouteComponentProps<{step: string}, {}>;

export default function RelocationOnboardingContainer(props: Props) {
  return (
    <Feature
      features={['relocation:enabled']}
      organizationAllowNull
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert.Container>
            <Alert type="warning">{t("You don't have access to this feature")}</Alert>
          </Alert.Container>
        </Layout.Page>
      )}
    >
      <RelocationOnboarding {...props} />
    </Feature>
  );
}
