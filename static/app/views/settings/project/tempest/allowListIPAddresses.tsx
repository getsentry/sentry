import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {t} from 'sentry/locale';
import {PACKAGE_LOADING_PLACEHOLDER} from 'sentry/utils/gettingStartedDocs/getPackageVersion';
import {useApiQuery} from 'sentry/utils/queryClient';

export const ALLOWLIST_IP_ADDRESSES_DESCRIPTION = t(
  'Allow list our Outbound IP addresses as they will be the once used for making the requests using the provided credentials'
);

export function AllowListIPAddresses() {
  const {data: ipAddresses, isPending} = useApiQuery<string>(
    [
      '/tempest-ips/',
      {
        headers: {
          Accept: 'text/html, text/plain, */*',
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  return (
    <OnboardingCodeSnippet>
      {isPending ? PACKAGE_LOADING_PLACEHOLDER : ipAddresses || ''}
    </OnboardingCodeSnippet>
  );
}
