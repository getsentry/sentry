import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {IntegrationProvider, IntegrationWithConfig} from 'sentry/types/integrations';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

const SEER_COMPATIBLE_PROVIDERS = new Set(['github', 'gitlab']);

interface Props {
  onAddIntegration: (data: IntegrationWithConfig) => void;
  providers: IntegrationProvider[];
}

export function ConnectProviderDropdown({providers, onAddIntegration}: Props) {
  const organization = useOrganization();
  const {startFlow} = useAddIntegration();

  const hasSeerCompatible = providers.some(p => SEER_COMPATIBLE_PROVIDERS.has(p.key));

  const items: MenuItemProps[] = providers.map(provider => {
    const isSeerCompatible = SEER_COMPATIBLE_PROVIDERS.has(provider.key);
    return {
      key: provider.key,
      label: isSeerCompatible ? (
        <Flex align="center" gap="sm">
          {provider.name}
          <Tooltip title={t('Compatible with Seer.')}>
            <Tag variant="promotion" icon={<IconSeer />} />
          </Tooltip>
        </Flex>
      ) : (
        provider.name
      ),
      textValue: provider.name,
      leadingItems: getIntegrationIcon(provider.key, 'sm'),
      disabled: !provider.canAdd,
      onAction: () =>
        startFlow({
          provider,
          organization,
          onInstall: onAddIntegration,
        }),
    };
  });

  return (
    <DropdownMenu
      items={items}
      triggerLabel={t('Connect new provider')}
      menuFooter={
        hasSeerCompatible ? (
          <Flex align="center" gap="sm" padding="md lg">
            <Tag variant="promotion" icon={<IconSeer />} />
            <Text size="xs" variant="muted">
              {tct('Compatible with [link:Seer].', {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/" />
                ),
              })}
            </Text>
          </Flex>
        ) : undefined
      }
    />
  );
}
