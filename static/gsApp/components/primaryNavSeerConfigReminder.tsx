import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useNavContext} from 'sentry/views/nav/context';
import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/views/nav/primary/components';
import {
  PrimaryButtonOverlay,
  usePrimaryButtonOverlay,
} from 'sentry/views/nav/primary/primaryButtonOverlay';
import {NavLayout} from 'sentry/views/nav/types';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';
import {useSeerOnboardingStep} from 'getsentry/views/seerAutomation/onboarding/hooks/useSeerOnboardingStep';
import {Steps} from 'getsentry/views/seerAutomation/onboarding/types';

// See also: `IntegrationProviderSlug` in sentry/integrations/types.py
// `vsts` is ignored for now, not on the early roadmap in January 2026.
const SCM_PROVIDER_KEYS = [
  'github',
  'github_enterprise',
  'gitlab',
  'bitbucket',
  'bitbucket_server',
];

/**
 * Fetches all SCM integrations for an organization, filtering for Seer related SCM providers.
 */
function useScmIntegrations() {
  const organization = useOrganization();
  const {data, isPending} = useApiQuery<Integration[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {includeConfig: 0}},
    ],
    {
      staleTime: 120000, // Cache for 2 minutes
    }
  );

  // Filter to only SCM integrations
  const scmIntegrations = data?.filter(integration =>
    SCM_PROVIDER_KEYS.includes(integration.provider.key)
  );

  const hasGithub = scmIntegrations?.some(integration =>
    ['github', 'github_enterprise'].includes(integration.provider.key)
  );

  const hasOnlyNonGithubScm =
    scmIntegrations &&
    scmIntegrations.length > 0 &&
    !hasGithub &&
    scmIntegrations.every(integration =>
      ['gitlab', 'bitbucket', 'bitbucket_server'].includes(integration.provider.key)
    );

  return {
    scmIntegrations,
    hasGithub,
    hasOnlyNonGithubScm,
    isPending,
  };
}

export default function PrimaryNavSeerConfigReminder() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const {isPending, initialStep} = useSeerOnboardingStep();

  const {hasOnlyNonGithubScm, isPending: isScmPending} = useScmIntegrations();

  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
    state,
  } = usePrimaryButtonOverlay();

  const {layout} = useNavContext();

  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');
  const hasSeer = hasSeatBasedSeer || hasLegacySeer || hasCodeReviewBeta;
  if (!hasSeer) {
    return null;
  }

  if (!canWrite && !isActiveSuperuser()) {
    return null;
  }

  if (isPending || isScmPending || initialStep === Steps.WRAP_UP) {
    return null;
  }

  // If org has zero SCM integrations  => show icon
  // If org has 1 or more GitHub SCM connections => show icon
  // If org has only BitBucket and/or GitLab SCM's => no icon
  if (hasOnlyNonGithubScm) {
    return null;
  }

  return (
    <Fragment>
      <SeerButton
        analyticsKey="seer-config-reminder"
        label={t('Configure Seer')}
        buttonProps={overlayTriggerProps}
      >
        <IconSeer />
        <SidebarItemUnreadIndicator
          data-test-id="seer-config-reminder-indicator"
          isMobile={layout === NavLayout.MOBILE}
        />
      </SeerButton>
      {isOpen && (
        <PrimaryButtonOverlay overlayProps={overlayProps}>
          <Stack gap="lg" padding="xl">
            <Heading as="h3">
              {hasSeatBasedSeer
                ? t('Finish configuring Seer')
                : hasLegacySeer
                  ? t('Start using Seer\u2019s AI Code Review')
                  : t('Start using Seer\u2019s Issue Autofix')}
            </Heading>
            <Text>
              {hasSeatBasedSeer
                ? t(
                    'Seer is desperately waiting to fix your broken code. Please set it up. Your future self will thank you.'
                  )
                : hasLegacySeer
                  ? t(
                      'Seer will catch issues in your (likely prompted) PRs. Don’t forget to configure it before you tag a human for review.'
                    )
                  : t(
                      'Seer will automatically root cause your issues, but only if you let it. Don’t forget to set that up.'
                    )}
            </Text>
            <Flex justify="end">
              <LinkButton
                to={{
                  pathname: `/organizations/${organization.slug}/settings/seer/`,
                  query: {
                    tab: hasSeatBasedSeer
                      ? undefined
                      : hasLegacySeer
                        ? 'repos'
                        : undefined,
                  },
                }}
                priority="primary"
                onClick={() => state.close()}
              >
                {t('Configure Now')}
              </LinkButton>
            </Flex>
          </Stack>
        </PrimaryButtonOverlay>
      )}
    </Fragment>
  );
}

const SeerButton = styled(SidebarButton)`
  display: none;

  /* TODO(ryan953): Make this shorter once showPreventNav() is removed from PrimaryNavigationItems */
  @media (min-height: 724px) {
    display: flex;
  }
`;
