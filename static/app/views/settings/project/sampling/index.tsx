import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import {Sampling} from './sampling';

type Props = {
  project: Project;
};

function Index(props: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={['filters-and-sampling']}
      organization={organization}
      renderDisabled={() => (
        <FeatureDisabled
          alert={PanelAlert}
          features={['organization:filters-and-sampling']}
          featureName={t('Sampling')}
        />
      )}
    >
      <Access organization={organization} access={['project:write']}>
        {({hasAccess}) => (
          <Sampling {...props} hasAccess={hasAccess} organization={organization} />
        )}
      </Access>
    </Feature>
  );
}

export default Index;
