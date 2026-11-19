import {IconAdd} from '@sentry/icons/add';
import {IconSeer} from '@sentry/icons/seer';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {useIsSeerSupportedProvider} from 'sentry/components/events/autofix/utils';
import {Panel} from 'sentry/components/panels/panel';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import type {IntegrationProvider, IntegrationWithConfig} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import {RequestIntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationRequest/RequestIntegrationButton';

interface Props {
  onAddIntegration: (data: IntegrationWithConfig) => void;
  providers: IntegrationProvider[];
}

export function NoIntegrationsEmptyState({providers, onAddIntegration}: Props) {
  const organization = useOrganization();
  const canInstall = hasEveryAccess(['org:integrations'], {organization});
  const isSeerSupported = useIsSeerSupportedProvider();

  return (
    <Panel>
      {providers.map(provider => (
        <PanelItem key={provider.key} center>
          <Flex align="center" gap="md" flex="1">
            {getIntegrationIcon(provider.key)}
            <Heading as="h4">{provider.name}</Heading>
            {isSeerSupported({id: provider.key, name: provider.name}) && (
              <Tooltip title={t('Compatible with Seer.')}>
                <Tag variant="promotion" icon={<IconSeer />}>
                  {t('Seer')}
                </Tag>
              </Tooltip>
            )}
          </Flex>
          {canInstall ? (
            <AddIntegrationButton
              provider={provider}
              organization={organization}
              onAddIntegration={onAddIntegration}
              size="sm"
              icon={<IconAdd />}
              buttonText={t('Connect')}
            />
          ) : (
            <RequestIntegrationButton
              name={provider.name}
              slug={provider.slug}
              type="first_party"
            />
          )}
        </PanelItem>
      ))}
    </Panel>
  );
}
