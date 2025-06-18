import {useCallback} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

import type {UpsellModalSamePriceProps} from 'getsentry/actionCreators/modal';
import {openAM2ProfilingUpsellModal} from 'getsentry/actionCreators/modal';
import type {Subscription} from 'getsentry/types';

export function useAM2ProfilingUpsellModal({
  subscription,
  onComplete,
}: {
  subscription: Subscription;
  onComplete?: UpsellModalSamePriceProps['onComplete'];
}) {
  const organization = useOrganization();

  const handleShowModal = useCallback(() => {
    openAM2ProfilingUpsellModal({
      organization,
      subscription,
      onComplete,
    });
  }, [organization, subscription, onComplete]);

  return {
    showModal: handleShowModal,
  };
}
