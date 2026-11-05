import {useState, type ReactNode} from 'react';
import {QueryClient, QueryClientProvider, skipToken} from '@tanstack/react-query';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Answers every Seer credit check with a fixed result. Other queries go to the
 * API as usual.
 */
class CreditCheckQueryClient extends QueryClient {
  hasEnoughCredits: boolean;

  constructor(hasEnoughCredits: boolean) {
    super({defaultOptions: {queries: {retry: false}}});
    this.hasEnoughCredits = hasEnoughCredits;
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    const url = String(defaulted.queryKey[0]);
    if (defaulted.queryFn === skipToken || !url.includes('/seer/credit-check/')) {
      return defaulted;
    }
    const json = {hasEnoughCredits: this.hasEnoughCredits};
    const queryFn = () => Promise.resolve({json, headers: {}});
    return {...defaulted, queryFn: queryFn as never};
  };
}

interface SeerCreditCheckStubProps {
  children: ReactNode;
  hasEnoughCredits: boolean;
}

/**
 * Turns on `seer-credit-checks` and answers every credit check with
 * `hasEnoughCredits`, so a story can show what a credit-gated button does
 * before and after the organization tops up.
 */
export function SeerCreditCheckStub({
  children,
  hasEnoughCredits,
}: SeerCreditCheckStubProps) {
  const organization = useOrganization();
  const [queryClient] = useState(() => new CreditCheckQueryClient(hasEnoughCredits));

  return (
    <OrganizationContext.Provider
      value={{
        ...organization,
        features: [...organization.features, 'seer-credit-checks'],
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </OrganizationContext.Provider>
  );
}
