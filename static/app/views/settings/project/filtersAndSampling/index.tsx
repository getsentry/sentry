import Access from 'app/components/acl/access';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import FiltersAndSampling from './filtersAndSampling';

type Props = {
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
    <Access organization={organization} access={['project:write']}>
      {({hasAccess}) => (
        <FiltersAndSampling
          {...props}
          hasAccess={hasAccess}
          organization={organization}
        />
      )}
    </Access>
  </Feature>
);

export default withOrganization(Index);
