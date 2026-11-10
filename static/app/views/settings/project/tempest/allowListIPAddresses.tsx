import {useQuery} from '@tanstack/react-query';

import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {PACKAGE_LOADING_PLACEHOLDER} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const ALLOWLIST_IP_ADDRESSES_DESCRIPTION = t(
  'Allow list our Outbound IP addresses as they will be the ones used for making the requests using the provided credentials'
);

export function AllowListIPAddresses() {
  const {data: ipAddresses, isPending} = useQuery(
    apiOptions.as<string>()('/tempest-ips/', {
      headers: {
        Accept: 'text/html, text/plain, */*',
      },
      staleTime: Infinity,
    })
  );

  return (
    <OnboardingCodeSnippet>
      {isPending ? PACKAGE_LOADING_PLACEHOLDER : ipAddresses || ''}
    </OnboardingCodeSnippet>
  );
}
