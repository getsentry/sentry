import type {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {PanelAlert} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {ReleaseActivityList} from './releaseActivity';

interface ReleaseDetailsActivityProps
  extends RouteComponentProps<{orgId: string; release: string}, {}> {}

function ReleaseDetailsActivity(props: ReleaseDetailsActivityProps) {
  const organization = useOrganization();

  return (
    <Feature
      features={['organizations:active-release-monitor-alpha']}
      organization={organization}
      renderDisabled={() => (
        <FeatureDisabled
          alert={PanelAlert}
          features={['organizations:active-release-monitor-alpha']}
          featureName={t('Release Details Activity')}
        />
      )}
    >
      <ReleaseActivityList {...props} />
    </Feature>
  );
}

export default ReleaseDetailsActivity;
