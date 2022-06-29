import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {ServerSideSampling} from './serverSideSampling';

export default function ServerSideSamplingContainer() {
  const organization = useOrganization();

  return (
    <Feature
      features={['server-side-sampling']}
      organization={organization}
      renderDisabled={() => (
        <FeatureDisabled
          alert={PanelAlert}
          features={['organization:server-side-sampling']}
          featureName={t('Server-side Sampling')}
        />
      )}
    >
      <ServerSideSampling />
    </Feature>
  );
}
