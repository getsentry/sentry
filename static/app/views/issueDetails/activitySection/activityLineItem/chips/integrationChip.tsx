import {Link} from '@sentry/scraps/link';

import {IconIssues, IconJira, IconLinear} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import type {GroupActivityIntegrationData} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';

import {InlineChip} from './inlineChip';

interface IntegrationIconProps extends SVGIconProps {
  provider: string;
}

export function IntegrationIcon({provider, ...props}: IntegrationIconProps) {
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider.includes('linear')) {
    return <IconLinear {...props} />;
  }
  if (normalizedProvider.includes('jira')) {
    return <IconJira {...props} />;
  }
  return <IconIssues {...props} />;
}

interface IntegrationChipProps {
  label: string;
  to: string;
}

function IntegrationChip({label, to}: IntegrationChipProps) {
  return (
    <Link to={to}>
      <InlineChip interactive>
        <IntegrationIcon provider={label} size="xs" />
        {label}
      </InlineChip>
    </Link>
  );
}

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
