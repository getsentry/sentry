import {mutationOptions} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

import type {ConsentDecision, DeviceCompletion, OAuthRedirect} from './types';

export function authorizationDecisionMutationOptions() {
  return mutationOptions({
    gcTime: 0,
    retry: false,
    mutationFn: (decision: ConsentDecision & {transactionId: string}) =>
      fetchMutation<OAuthRedirect>({
        url: getApiUrl('/auth/oauth/authorize/'),
        method: 'POST',
        data: {...decision},
      }),
  });
}

export function deviceDecisionMutationOptions() {
  return mutationOptions({
    gcTime: 0,
    retry: false,
    mutationFn: (decision: ConsentDecision & {userCode: string}) =>
      fetchMutation<DeviceCompletion>({
        url: getApiUrl('/auth/oauth/device/'),
        method: 'POST',
        data: {...decision},
      }),
  });
}
