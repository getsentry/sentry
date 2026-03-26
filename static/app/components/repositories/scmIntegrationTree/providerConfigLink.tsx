import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';

export function getProviderConfigUrl(
  integration: OrganizationIntegration
): string | null {
  const {externalId, provider, domainName, accountType} = integration;
  if (!externalId) {
    return null;
  }

  if (provider.key === 'github') {
    if (accountType === 'Organization' && domainName) {
      const orgName = domainName.replace(/^github\.com\//, '');
      return `https://github.com/organizations/${orgName}/settings/installations/${externalId}`;
    }
    return `https://github.com/settings/installations/${externalId}`;
  }

  if (provider.key === 'github_enterprise') {
    if (domainName) {
      // GHE externalId format is "<host>:<numeric_installation_id>"
      const installationId = externalId.split(':').at(-1);
      const host = domainName.split('/')[0];
      if (accountType === 'Organization') {
        const orgName = domainName.replace(`${host}/`, '');
        return `https://${host}/organizations/${orgName}/settings/installations/${installationId}`;
      }
      return `https://${host}/settings/installations/${installationId}`;
    }
    return null;
  }

  return null;
}

export function ProviderConfigLink({
  integration,
}: {
  integration: OrganizationIntegration;
}) {
  const externalConfigUrl = getProviderConfigUrl(integration);

  if (!externalConfigUrl) {
    return null;
  }
  return (
    <Flex align="center" gap="xs">
      <Tooltip title={t('External installation settings')} skipWrapper>
        <ExternalLink href={externalConfigUrl} onClick={e => e.stopPropagation()}>
          {integration.provider.name} <IconOpen size="xs" />
        </ExternalLink>
      </Tooltip>
    </Flex>
  );
}
