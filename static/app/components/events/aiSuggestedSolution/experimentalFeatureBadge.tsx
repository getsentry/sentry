import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';

export function ExperimentalFeatureBadge() {
  return <CenteredFeatureBadge tooltipProps={{disabled: true}} type="experimental" />;
}

const CenteredFeatureBadge = styled(FeatureBadge)`
  height: ${p => p.theme.space(2)};
`;
