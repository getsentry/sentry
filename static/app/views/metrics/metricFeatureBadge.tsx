import FeatureBadge from 'sentry/components/badge/featureBadge';
import useOrganization from 'sentry/utils/useOrganization';

import {hasRolledOutMetrics} from '../../utils/metrics/features';

export function MetricsFeatureBadge() {
  const organization = useOrganization();

  if (hasRolledOutMetrics(organization)) {
    return <FeatureBadge type="new" />;
  }

  return <FeatureBadge type="beta" />;
}
