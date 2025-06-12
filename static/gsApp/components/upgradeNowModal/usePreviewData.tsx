import type {ReactElement} from 'react';

import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {Plan, PreviewData, Subscription} from 'getsentry/types';

import type {Reservations} from './types';
import useUpgradeNowParams from './useUpgradeNowParams';

type Result =
  | {
      error: false;
      loading: true;
      plan: undefined;
      previewData: undefined;
      reservations: undefined;
    }
  | {
      error: false;
      loading: false;
      plan: Plan;
      previewData: PreviewData;
      reservations: Reservations;
    }
  | {
      error: true;
      loading: false;
      plan: undefined;
      previewData: undefined;
      reservations: undefined;
    };

type Props = {
  children: (props: Result) => ReactElement;
  organization: Organization;
  subscription: Subscription;
  enabled?: boolean;
};

export default function usePreviewData({
  organization,
  subscription,
  enabled = true,
}: Omit<Props, 'children'>): Result {
  const hasBillingAccess = organization.access?.includes('org:billing');
  const {plan, reservations} = useUpgradeNowParams({
    organization,
    subscription,
    enabled: enabled && hasBillingAccess,
  });

  const {
    isPending,
    isError,
    data: previewData,
  } = useApiQuery<PreviewData>(
    [
      `/customers/${organization.slug}/subscription/preview/`,
      {
        query: {
          ...reservations,
          plan: plan?.id,
          referrer: 'replay-am2-update-modal',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!plan && !!reservations && hasBillingAccess && enabled,
    }
  );

  if (isError) {
    return {
      loading: false,
      error: true,
      plan: undefined,
      reservations: undefined,
      previewData: undefined,
    };
  }

  if (isPending || !plan || !reservations || !previewData) {
    return {
      loading: true,
      error: false,
      plan: undefined,
      reservations: undefined,
      previewData: undefined,
    };
  }

  return {
    loading: false,
    error: false,
    plan,
    previewData,
    reservations,
  };
}
