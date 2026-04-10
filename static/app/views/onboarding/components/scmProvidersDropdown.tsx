import {Fragment, useEffect, useRef} from 'react';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAddIntegration} from 'sentry/views/settings/organizationIntegrations/addIntegration';

interface ScmProvidersDropdownProps {
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

/**
 * Renders secondary SCM providers (Bitbucket Server, GitHub Enterprise, Azure
 * DevOps, etc.) inside a dropdown menu. Each provider's install flow is
 * initialized by a hidden {@link ScmProviderFlowSetup} component so that the
 * `startFlow` callback is available synchronously from the menu item's click
 * handler (required to avoid browser popup blockers for OAuth windows).
 */
export function ScmProvidersDropdown({providers, onInstall}: ScmProvidersDropdownProps) {
  const flowMapRef = useRef<Map<string, () => void>>(new Map());

  return (
    <Fragment>
      {providers.map(provider => (
        <ScmProviderFlowSetup
          key={provider.key}
          provider={provider}
          onInstall={onInstall}
          flowMapRef={flowMapRef}
        />
      ))}
      <DropdownMenu
        triggerLabel={t('More')}
        position="bottom-end"
        items={providers.map(provider => ({
          key: provider.key,
          label: provider.name,
          leadingItems: getIntegrationIcon(provider.key, 'sm'),
          onAction: () => flowMapRef.current.get(provider.key)?.(),
        }))}
      />
    </Fragment>
  );
}

interface ScmProviderFlowSetupProps {
  flowMapRef: React.RefObject<Map<string, () => void>>;
  onInstall: (data: Integration) => void;
  provider: IntegrationProvider;
}

/**
 * Invisible component that initializes {@link useAddIntegration} for a single
 * provider and registers the resulting `startFlow` function in a shared ref
 * map. This lets the parent's {@link DropdownMenu} trigger the correct
 * OAuth/pipeline flow from a data-driven menu item.
 */
function ScmProviderFlowSetup({
  provider,
  onInstall,
  flowMapRef,
}: ScmProviderFlowSetupProps) {
  const organization = useOrganization();
  const {startFlow} = useAddIntegration({
    provider,
    organization,
    onInstall,
    analyticsParams: {
      view: 'onboarding',
      already_installed: false,
    },
  });

  useEffect(() => {
    flowMapRef.current.set(provider.key, startFlow);
  }, [flowMapRef, provider.key, startFlow]);

  return null;
}
