import React from 'react';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';

import Relays from './relays';

const OrganizationRelays = ({organization, ...props}: Relays['props']) => (
  <Feature
    features={['relay']}
    organization={organization}
    renderDisabled={() => (
      <FeatureDisabled
        alert={PanelAlert}
        features={organization.features}
        featureName={t('Relays')}
      />
    )}
  >
    <Relays organization={organization} {...props} />
  </Feature>
);

export default withOrganization(OrganizationRelays);
