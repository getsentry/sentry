import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

function ProgressiveLoadingIndicator({
  visualizationType,
}: {
  visualizationType: 'chart' | 'table';
}) {
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

  const tooltip =
    visualizationType === 'chart'
      ? t('Chart is currently loading more data')
      : t('Table is currently loading more data');

  return (
    <Tooltip title={tooltip}>
      <_ProgressiveLoadingIndicator
        relative
        mini
        size={16}
        data-test-id="progressive-loading-indicator"
      />
    </Tooltip>
  );
}

export const getProgressiveLoadingIndicator = (
  isProgressivelyLoading = false,
  visualizationType: 'chart' | 'table'
) => {
  if (isProgressivelyLoading) {
    return (
      <ProgressiveLoadingIndicator
        key="progressive-loading-indicator"
        visualizationType={visualizationType}
      />
    );
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
