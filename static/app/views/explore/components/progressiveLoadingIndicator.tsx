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
  if (!canUseProgressiveLoading) {
    return null;
  }

  return (
    <Tooltip title={t('This widget is currently loading higher fidelity data.')}>
      <_ProgressiveLoadingIndicator
        relative
        hideMessage
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
