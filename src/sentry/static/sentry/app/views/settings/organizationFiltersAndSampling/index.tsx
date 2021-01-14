import React from 'react';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import OrganizationFiltersAndSampling from './organizationFiltersAndSampling';

type Props = {
  organization: Organization;
};

const Index = ({organization}: Props) => (
  <Feature
    features={['filters-and-sampling']}
    organization={organization}
    renderDisabled={() => (
      <FeatureDisabled
        alert={PanelAlert}
        features={organization.features}
        featureName={t('Filters & Sampling')}
      />
    )}
  >
    <OrganizationFiltersAndSampling />
  </Feature>
);

export default withOrganization(Index);
