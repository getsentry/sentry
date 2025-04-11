import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

function ProgressiveLoadingIndicator() {
  const organization = useOrganization();
  const canUseProgressiveLoading = organization.features.includes(
    'visibility-explore-progressive-loading'
  );

  // Skipping preflight means we _only_ have one request. We do not need
  // the loading indicator because this loader is only meant to show there is
  // more data to load beyond the first one. If there is only one request,
  // this loader is redundant.
  const skipPreflight = organization.features.includes(
    'visibility-explore-skip-preflight'
  );

  if (!canUseProgressiveLoading || skipPreflight) {
    return null;
  }

  return (
    <Tooltip title={t('This widget is currently loading higher fidelity data.')}>
      <_ProgressiveLoadingIndicator
        relative
        mini
        size={16}
        data-test-id="progressive-loading-indicator"
      />
    </Tooltip>
  );
}

export const getProgressiveLoadingIndicator = (isProgressivelyLoading = false) => {
  if (isProgressivelyLoading) {
    return <ProgressiveLoadingIndicator key="progressive-loading-indicator" />;
  }
  return null;
};

const _ProgressiveLoadingIndicator = styled(LoadingIndicator)`
  .loading-indicator {
    border-width: 2px;
  }

  display: flex;
  align-items: center;
  justify-content: center;
`;
