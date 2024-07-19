import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {space} from 'sentry/styles/space';

export function ExperimentalFeatureBadge() {
  return <CenteredFeatureBadge tooltipProps={{disabled: true}} type="experimental" />;
}

const CenteredFeatureBadge = styled(FeatureBadge)`
  height: ${space(2)};
`;
