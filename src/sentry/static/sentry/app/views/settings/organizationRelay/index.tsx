import React from 'react';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import Access from 'app/components/acl/access';

import RelayWrapper from './relayWrapper';

const OrganizationRelay = ({organization, ...props}: RelayWrapper['props']) => (
  <Access access={['org:admin']} organization={organization}>
    <Feature
      features={['relay']}
      organization={organization}
      renderDisabled={() => (
        <FeatureDisabled
          alert={PanelAlert}
          features={organization.features}
          featureName={t('Relay')}
        />
      )}
    >
      <RelayWrapper organization={organization} {...props} />
    </Feature>
  </Access>
);

export default withOrganization(OrganizationRelay);
