import {Link} from '@sentry/scraps/link';

import type {GroupActivityIntegrationData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';

export function getIntegrationLink({
  data,
  organization,
}: {
  data: GroupActivityIntegrationData;
  organization: Organization;
}) {
  const integrationId = data.integration_id;
  const providerKey = data.provider_key;
  const provider = data.provider;

  if (integrationId === undefined || !providerKey || !provider) {
    return null;
  }

  return (
    <Link
      to={`/settings/${organization.slug}/integrations/${providerKey}/${integrationId}/`}
    >
      {provider}
    </Link>
  );
}
