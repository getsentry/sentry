import type {Organization} from 'sentry/types/organization';

import GSBanner from 'getsentry/components/gsBanner';

interface Props {
  organization: Organization;
}

export function OrganizationHeader({organization}: Props) {
  return <GSBanner organization={organization} />;
}
