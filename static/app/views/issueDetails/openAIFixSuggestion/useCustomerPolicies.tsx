import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Policies = Record<
  string,
  {
    active: boolean;
    consent: null | {
      createdAt: string;
      userEmail: string;
      userName: string;
    };
    createdAt: string;
    hasSignature: boolean;
    name: string;
    parent: null;
    slug: string;
    standalone: boolean;
    updatedAt: string;
    url: string;
    userEmail: string;
    userName: string;
    version: string;
  }
>;

export function useCustomerPolicies() {
  const organization = useOrganization();
  const {data} = useQuery<Policies>([`/customers/${organization.slug}/policies/`], {
    staleTime: Infinity,
  });

  return {
    hasSignedDPA: !!data?.dpa.consent,
  };
}
