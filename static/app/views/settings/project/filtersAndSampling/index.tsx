import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import FiltersAndSampling from './filtersAndSampling';

type Props = {
  organization: Organization;
  project: Project;
};

const Index = ({organization, ...props}: Props) => (
  <Feature
    features={['filters-and-sampling']}
    organization={organization}
    renderDisabled={() => (
      <FeatureDisabled
        alert={PanelAlert}
        features={['organization:filters-and-sampling']}
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
