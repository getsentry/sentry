import {Fragment, useRef} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAddIntegration} from 'sentry/views/settings/organizationIntegrations/addIntegration';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

/**
 * Provider keys shown as top-level pill buttons. Everything else is grouped
 * into the "More" dropdown to reduce visual clutter.
 */
const PRIMARY_PROVIDER_KEYS = new Set(['github', 'gitlab', 'bitbucket']);

interface ScmProviderPillsProps {
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

export function ScmProviderPills({providers, onInstall}: ScmProviderPillsProps) {
  const primaryProviders = providers.filter(p => PRIMARY_PROVIDER_KEYS.has(p.key));
  const moreProviders = providers.filter(p => !PRIMARY_PROVIDER_KEYS.has(p.key));

  return (
    <Flex justify="center">
      <Grid
        columns={{
          xs: '1fr 1fr',
          md: `repeat(${primaryProviders.length}, 1fr) min-content`,
        }}
        rows={{xs: 2}}
        justify="center"
        gap="lg"
      >
        {primaryProviders.map(provider => (
          <IntegrationContext
            key={provider.key}
            value={{
              provider,
              type: 'first_party',
              installStatus: 'Not Installed',
              analyticsParams: {
                view: 'onboarding_scm',
                already_installed: false,
              },
            }}
          >
            <IntegrationButton
              userHasAccess
              onAddIntegration={onInstall}
              onExternalClick={() => {}}
              buttonProps={{
                icon: getIntegrationIcon(provider.key, 'sm'),
                buttonText: provider.name,
              }}
            />
          </IntegrationContext>
        ))}
        {moreProviders.length > 0 && (
          <MoreProvidersDropdown providers={moreProviders} onInstall={onInstall} />
        )}
      </Grid>
    </Flex>
  );
}

interface MoreProvidersDropdownProps {
  onInstall: (data: Integration) => void;
  providers: IntegrationProvider[];
}

/**
 * Renders secondary SCM providers (Bitbucket Server, GitHub Enterprise, Azure
 * DevOps, etc.) inside a dropdown menu. Each provider's install flow is
 * initialized by a hidden {@link ProviderFlowSetup} component so that the
 * `startFlow` callback is available synchronously from the menu item's click
 * handler (required to avoid browser popup blockers for OAuth windows).
 */
function MoreProvidersDropdown({providers, onInstall}: MoreProvidersDropdownProps) {
  const flowMapRef = useRef<Map<string, () => void>>(new Map());

  return (
    <Fragment>
      {providers.map(provider => (
        <ProviderFlowSetup
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

interface ProviderFlowSetupProps {
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
function ProviderFlowSetup({provider, onInstall, flowMapRef}: ProviderFlowSetupProps) {
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

  flowMapRef.current.set(provider.key, startFlow);

  return null;
}
