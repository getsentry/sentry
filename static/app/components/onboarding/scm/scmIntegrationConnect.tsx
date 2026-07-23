import {useCallback, useEffect, useRef} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack, type StackProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

import {type ScmAnalyticsFlow, scmFlowVariantParams} from './scmAnalyticsFlow';
import {ScmIntegrationSelect} from './scmIntegrationSelect';
import {ScmProviderPills} from './scmProviderPills';
import {ScmRepoSelector} from './scmRepoSelector';
import {useScmPlatformDetection} from './useScmPlatformDetection';
import {useScmProviders} from './useScmProviders';

const INTEGRATION_SELECTED_EVENT = {
  onboarding: 'onboarding.scm_connect_integration_selected',
  'project-creation': 'project_creation.connect_integration_selected',
} as const;

interface ScmIntegrationConnectProps {
  analyticsFlow: ScmAnalyticsFlow;
  // Fired once per user-driven repo change so callers can invalidate state
  // derived from the repo (platform, features, created project). See
  // ScmRepoSelector for why this is separate from onRepositoryChange.
  onClearDerivedState: () => void;
  onIntegrationChange: (integration: Integration | undefined) => void;
  onRepositoryChange: (repo: Repository | undefined) => void;
  selectedIntegration: Integration | undefined;
  selectedRepository: Repository | undefined;
  // When true, the connected state renders a dropdown for switching between
  // connected integrations (provider + org/account). When false (default), it
  // renders static "Connected to ..." text for the single active integration.
  allowIntegrationSwitching?: boolean;
  maxWidth?: StackProps['maxWidth'];
}

/**
 * Core integration-and-repo connection mechanic shared by the SCM connect step
 * (`ScmConnect`) and the SCM-first project creation surface. Renders the
 * provider install pills when no integration is connected, or the repo
 * selector when one is. Owns integration data fetching, platform detection
 * pre-warming, and the `scm_connect_step_viewed` analytic.
 *
 * With `allowIntegrationSwitching`, the connected state also renders an
 * integration selector so the user can pick which connected integration to
 * search repos within; otherwise it shows static "Connected to ..." text.
 *
 * Does NOT render the connect step's onboarding chrome (intro heading,
 * lock/revoke text, benefits grid, Continue/Skip footer). Hosts compose the
 * chrome they need around this component.
 */
export function ScmIntegrationConnect({
  analyticsFlow,
  onClearDerivedState,
  onIntegrationChange,
  onRepositoryChange,
  selectedIntegration,
  selectedRepository,
  allowIntegrationSwitching = false,
  maxWidth = SCM_STEP_CONTENT_WIDTH,
}: ScmIntegrationConnectProps) {
  const organization = useOrganization();
  const {
    scmProviders,
    activeIntegrations,
    isPending,
    isError,
    refetch,
    refetchIntegrations,
  } = useScmProviders();

  // Pre-warm platform detection so results are cached when the user advances
  useScmPlatformDetection(selectedRepository);

  // Derive integration from explicit selection, falling back to the first
  // active integration so the repo selector has something to search.
  const effectiveIntegration = selectedIntegration ?? activeIntegrations[0];

  // Guards the auto-select analytics event below so it fires once.
  const defaultIntegrationTrackedRef = useRef(false);

  useEffect(() => {
    // Onboarding views this as a discrete step. Single-view project creation
    // shows all sections at once and fires one page-viewed event in
    // scmCreateProject, so suppress the per-section step_viewed there.
    if (analyticsFlow !== 'onboarding') {
      return;
    }
    trackAnalytics('onboarding.scm_connect_step_viewed', {organization});
  }, [organization, analyticsFlow]);

  // Fire scm_connect_integration_selected once for the integration auto-selected
  // on entry, when the selector is in use and the user hasn't explicitly picked
  // one. Otherwise a user who keeps the default never emits the event, leaving
  // the funnel without an integration-selected step. An explicit switch fires
  // its own `source: 'manual'` event in the handler below.
  useEffect(() => {
    if (
      !allowIntegrationSwitching ||
      defaultIntegrationTrackedRef.current ||
      selectedIntegration ||
      !effectiveIntegration
    ) {
      return;
    }
    defaultIntegrationTrackedRef.current = true;
    trackAnalytics(INTEGRATION_SELECTED_EVENT[analyticsFlow], {
      organization,
      provider: effectiveIntegration.provider.key,
      source: 'default',
      ...scmFlowVariantParams(analyticsFlow),
    });
  }, [
    allowIntegrationSwitching,
    selectedIntegration,
    effectiveIntegration,
    analyticsFlow,
    organization,
  ]);

  const handleInstall = useCallback(
    (data: Integration) => {
      onIntegrationChange(data);
      onRepositoryChange(undefined);
      refetchIntegrations();
    },
    [onIntegrationChange, onRepositoryChange, refetchIntegrations]
  );

  // Switching integrations invalidates the selected repo (repos are scoped to
  // an integration) and everything derived from it (platform, features, form).
  const handleIntegrationSelect = useCallback(
    (integration: Integration) => {
      // Reselecting the active integration is a no-op; clearing here would wipe
      // the in-progress repo/platform/form for no reason (CompactSelect fires
      // onChange even when the already-selected option is re-picked).
      if (integration.id === effectiveIntegration?.id) {
        return;
      }
      onClearDerivedState();
      onIntegrationChange(integration);
      onRepositoryChange(undefined);
      trackAnalytics(INTEGRATION_SELECTED_EVENT[analyticsFlow], {
        organization,
        provider: integration.provider.key,
        source: 'manual',
        ...scmFlowVariantParams(analyticsFlow),
      });
    },
    [
      analyticsFlow,
      organization,
      effectiveIntegration?.id,
      onClearDerivedState,
      onIntegrationChange,
      onRepositoryChange,
    ]
  );

  if (isPending) {
    return (
      <Flex justify="center" align="center">
        <LoadingIndicator mini />
      </Flex>
    );
  }

  if (isError) {
    return (
      <Stack gap="lg" align="center">
        <Text variant="muted">{t('Failed to load integrations.')}</Text>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
      </Stack>
    );
  }

  return effectiveIntegration ? (
    <Stack
      key="with-integration"
      gap="md"
      width="100%"
      maxWidth={maxWidth}
      paddingTop={allowIntegrationSwitching ? undefined : '2xl'}
    >
      {allowIntegrationSwitching ? null : (
        <Text bold size="sm" density="compressed" uppercase>
          {t(
            'Connected to %s / %s',
            effectiveIntegration.provider.name,
            effectiveIntegration.name
          )}
        </Text>
      )}
      <Flex
        direction={{'screen:sm': 'column-reverse', 'screen:md': 'row'}}
        width="100%"
        gap="md"
        align={{'screen:sm': 'start', 'screen:md': 'center'}}
      >
        <ScmRepoSelector
          analyticsFlow={analyticsFlow}
          integration={effectiveIntegration}
          selectedRepository={selectedRepository}
          onRepositoryChange={onRepositoryChange}
          onClearDerivedState={onClearDerivedState}
        />
        {allowIntegrationSwitching ? (
          <ScmIntegrationSelect
            integrations={activeIntegrations}
            selectedIntegration={effectiveIntegration}
            onChange={handleIntegrationSelect}
          />
        ) : null}
      </Flex>
    </Stack>
  ) : (
    <Stack key="without-integration" gap="2xl" width="100%" maxWidth={maxWidth}>
      <ScmProviderPills
        analyticsFlow={analyticsFlow}
        providers={scmProviders}
        onInstall={handleInstall}
      />
    </Stack>
  );
}
