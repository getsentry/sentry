import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';

import RelocationOnboarding from './relocation';

type Props = RouteComponentProps<{step: string}, {}>;

export default function RelocationOnboardingContainer(props: Props) {
  return (
    <Feature
      features={['relocation:enabled']}
      renderDisabled={() => (
        <Layout.Page withPadding>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Layout.Page>
      )}
    >
      <RelocationOnboarding {...props} />
    </Feature>
  );
}
