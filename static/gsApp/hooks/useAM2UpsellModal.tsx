import {useCallback} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

import type {UpsellModalSamePriceProps} from 'getsentry/actionCreators/modal';
import {
  openAM2UpsellModal,
  openAM2UpsellModalSamePrice,
} from 'getsentry/actionCreators/modal';
import usePreviewData from 'getsentry/components/upgradeNowModal/usePreviewData';
import type {Subscription} from 'getsentry/types';
import type {AM2UpdateSurfaces} from 'getsentry/utils/trackGetsentryAnalytics';

export function useAM2UpsellModal({
  subscription,
  surface,
  onComplete,
  enabled = true,
}: {
  subscription: Subscription;
  surface: AM2UpdateSurfaces;
  enabled?: boolean;
  onComplete?: UpsellModalSamePriceProps['onComplete'];
}) {
  const organization = useOrganization();
  const previewData = usePreviewData({organization, subscription, enabled});

  const handleShowModal = useCallback(() => {
    if (previewData.loading || !enabled) {
      return;
    }

    if (previewData.error) {
      return;
    }

    if (previewData.previewData?.billedAmount === 0) {
      openAM2UpsellModalSamePrice({
        organization,
        subscription,
        surface,
        onComplete,
        ...previewData,
      });
      return;
    }

    openAM2UpsellModal({
      organization,
      subscription,
      surface,
      ...previewData,
    });
  }, [organization, subscription, previewData, onComplete, surface, enabled]);

  return {
    showModal: handleShowModal,
  };
}
