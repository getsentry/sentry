import {useMemo} from 'react';

import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {IconAdd} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Menu items for handing an Autofix run off to a connected coding agent, shared
 * by the Seer drawer, issue preview, and Autofix overview dropdowns. Items carry
 * a per-item disabled/tooltip; callers that gate the whole trigger can ignore it.
 */
export function useCodingAgentMenuItems({
  codingAgentIntegrations,
  codingAgentDisabledReason,
  onCodingAgentHandoff,
}: {
  codingAgentIntegrations: CodingAgentIntegration[] | undefined;
  onCodingAgentHandoff: (integration: CodingAgentIntegration) => void;
  codingAgentDisabledReason?: string;
}): MenuItemProps[] {
  return useMemo(
    () =>
      (codingAgentIntegrations ?? []).map(integration => {
        const actionLabel =
          integration.requires_identity && !integration.has_identity
            ? t('Setup %s', integration.name)
            : t('Send to %s', integration.name);

        return {
          key: `agent:${integration.id ?? integration.provider}`,
          textValue: actionLabel,
          label: (
            <Flex gap="md" align="center">
              <PluginIcon pluginId={integration.provider} size={16} />
              <span>{actionLabel}</span>
            </Flex>
          ),
          disabled: defined(codingAgentDisabledReason),
          tooltip: codingAgentDisabledReason,
          onAction: () => onCodingAgentHandoff(integration),
        };
      }),
    [codingAgentIntegrations, codingAgentDisabledReason, onCodingAgentHandoff]
  );
}

export function CodingAgentMenuFooter() {
  const organization = useOrganization();
  return (
    <DropdownMenuFooter>
      <MenuComponents.CTALinkButton
        icon={<IconAdd />}
        to={`/settings/${organization.slug}/integrations/?category=coding%20agent`}
      >
        {t('Add Integration')}
      </MenuComponents.CTALinkButton>
    </DropdownMenuFooter>
  );
}
