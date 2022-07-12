import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import ReleaseActivity from './releaseActivity';

export default function ReleaseDetailsActivity() {
  const organization = useOrganization();

  return (
    <Feature
      features={['organizations:active-release-monitor-alpha']}
      organization={organization}
      renderDisabled={() => (
        <FeatureDisabled
          alert={PanelAlert}
          features={['organizations:active-release-monitor-alpha']}
          featureName={t('Release Details Activity')}
        />
      )}
    >
      <ReleaseActivity />
    </Feature>
  );
}
