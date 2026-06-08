import {useCallback, useEffect} from 'react';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack, type StackProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmProviderPills} from './scmProviderPills';
import {ScmRepoSelector} from './scmRepoSelector';
import {useMultiPlatformDetectionTest} from './useMultiPlatformDetectionTest';
import {useScmPlatformDetection} from './useScmPlatformDetection';
import {useScmProviders} from './useScmProviders';

const STEP_VIEWED_EVENT = {
  onboarding: 'onboarding.scm_connect_step_viewed',
  'project-creation': 'project_creation.scm_connect_step_viewed',
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
  maxWidth?: StackProps['maxWidth'];
}

/**
 * Core integration-and-repo connection mechanic shared by the SCM connect step
 * (`ScmConnect`) and the SCM-first project creation surface. Renders the
 * provider install pills when no integration is connected, or the repo
 * selector when one is. Owns integration data fetching, platform detection
 * pre-warming, and the `scm_connect_step_viewed` analytic.
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
  maxWidth = SCM_STEP_CONTENT_WIDTH,
}: ScmIntegrationConnectProps) {
  const organization = useOrganization();
  const {
    scmProviders,
    isPending,
    isError,
    refetch,
    refetchIntegrations,
    activeIntegrationExisting,
  } = useScmProviders();

  // Pre-warm platform detection so results are cached when the user advances
  useScmPlatformDetection(selectedRepository);

  // Measurement call, to judge latency (no UI impact).
  useMultiPlatformDetectionTest(selectedRepository);

  // Derive integration from explicit selection, falling back to existing
  const effectiveIntegration = selectedIntegration ?? activeIntegrationExisting;

  useEffect(() => {
    trackAnalytics(STEP_VIEWED_EVENT[analyticsFlow], {organization});
  }, [organization, analyticsFlow]);

  const handleInstall = useCallback(
    (data: Integration) => {
      onIntegrationChange(data);
      onRepositoryChange(undefined);
      refetchIntegrations();
    },
    [onIntegrationChange, onRepositoryChange, refetchIntegrations]
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
    <MotionStack key="with-integration" gap="xl" width="100%" maxWidth={maxWidth}>
      <Stack gap="md" paddingTop="2xl">
        <Text variant="secondary" bold size="sm" density="compressed" uppercase>
          {t(
            'Connected to %s / %s',
            effectiveIntegration.provider.name,
            effectiveIntegration.name
          )}
        </Text>
        <ScmRepoSelector
          analyticsFlow={analyticsFlow}
          integration={effectiveIntegration}
          selectedRepository={selectedRepository}
          onRepositoryChange={onRepositoryChange}
          onClearDerivedState={onClearDerivedState}
        />
      </Stack>
    </MotionStack>
  ) : (
    <MotionStack key="without-integration" gap="2xl" width="100%" maxWidth={maxWidth}>
      <ScmProviderPills providers={scmProviders} onInstall={handleInstall} />
    </MotionStack>
  );
}

const MotionStack = motion.create(Stack);
