import React from 'react';
import {RouteComponentProps} from 'react-router';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import FiltersAndSampling from './filtersAndSampling';

type Props = RouteComponentProps<{projectId: string; orgId: string}, {}> & {
  organization: Organization;
};

const Index = ({organization, ...props}: Props) => (
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
    <FiltersAndSampling
      {...props}
      organization={{...organization, dynamicSampling: []}}
    />
  </Feature>
);

export default withOrganization(Index);
