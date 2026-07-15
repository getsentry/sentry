import type {GroupActivityIntegrationData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {IntegrationChip} from 'sentry/views/issueDetails/activitySection/activityLineItem/chips/integrationChip';

export function getIntegrationChip({
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
    <IntegrationChip
      label={provider}
      to={`/settings/${organization.slug}/integrations/${providerKey}/${integrationId}/`}
    />
  );
}
