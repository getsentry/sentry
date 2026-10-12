import {useEffect, useRef} from 'react';
import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';
import type {EmailAuthResult} from 'sentry/views/authV2/authLogin/hooks/useEmailAuth';
import type {AuthenticatedResult, MfaMethod} from 'sentry/views/authV2/authLogin/types';

type DemoAuthResponse =
  | {mfaMethods: MfaMethod[]; mfaRequired: true}
  | AuthenticatedResult;

interface Props {
  authOrganization: AuthOrganization | undefined;
  enabled: boolean;
  onAuthResult: (result: EmailAuthResult) => void;
  nextUri?: string;
}

export function useDemoLogin({authOrganization, enabled, nextUri, onAuthResult}: Props) {
  const organizationSlug =
    enabled && authOrganization?.loginMethod === 'demo'
      ? authOrganization.organization.slug
      : undefined;
  const attemptedOrganization = useRef<string | null>(null);
  const {mutate: authenticate, reset} = useMutation({
    throwOnError: true,
    mutationFn: async (slug: string): Promise<EmailAuthResult> => {
      const response = await fetchMutation<DemoAuthResponse>({
        url: getApiUrl('/auth/organizations/$organizationIdOrSlug/demo/', {
          path: {organizationIdOrSlug: slug},
        }),
        method: 'POST',
        data: {nextUri: nextUri ?? null},
      }).catch(error => {
        throw new Error('Demo authentication failed', {cause: error});
      });

      return 'mfaRequired' in response
        ? {status: 'mfa-required', methods: response.mfaMethods}
        : {status: 'authenticated', ...response};
    },
  });
  useEffect(() => {
    if (!organizationSlug || attemptedOrganization.current === organizationSlug) {
      return;
    }

    attemptedOrganization.current = organizationSlug;
    authenticate(organizationSlug, {onSuccess: onAuthResult});
  }, [authenticate, onAuthResult, organizationSlug]);

  return {
    // Keep loading active after success until navigation completes or MFA renders.
    isLoading: Boolean(organizationSlug),
    reset: () => {
      attemptedOrganization.current = null;
      reset();
    },
  };
}
