import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import {DynamicSampling} from './dynamicSampling';

type Props = {
  project: Project;
};

export default function DynamicSamplingContainer({project}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['dynamic-sampling']}
      organization={organization}
      renderDisabled={() => (
        <FeatureDisabled
          alert={PanelAlert}
          features={['organizations:dynamic-sampling']}
          featureName={t('Dynamic Sampling')}
        />
      )}
    >
      <DynamicSampling project={project} />
    </Feature>
  );
}
