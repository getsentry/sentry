import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import {ServerSideSampling} from './serverSideSampling';

type Props = {
  project: Project;
};

export default function ServerSideSamplingContainer({project}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['server-side-sampling']}
      organization={organization}
      renderDisabled={() => (
        <FeatureDisabled
          alert={PanelAlert}
          features={['organization:server-side-sampling']}
          featureName={t('Server-Side Sampling')}
        />
      )}
    >
      <ServerSideSampling project={project} />
    </Feature>
  );
}
