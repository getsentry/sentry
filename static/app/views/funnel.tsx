import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function Funnel() {
  const organization = useOrganization();
  useApiQuery<any>([`/organizations/${organization.slug}/funnel/`], {
    staleTime: Infinity,
  });
  return <div>Hi</div>;
}
