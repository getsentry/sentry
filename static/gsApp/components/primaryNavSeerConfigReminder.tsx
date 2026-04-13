import {Fragment, useEffect, useMemo} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSeerOnboardingCheckQueryOptions} from 'sentry/utils/getSeerOnboardingCheckQueryOptions';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  PrimaryNavigation,
  usePrimaryNavigationButtonOverlay,
} from 'sentry/views/navigation/primary/components';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

function useReminderData() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');

  const analyticsParams = useMemo(() => {
    return {
      can_write_settings: canWrite,
      has_code_review_beta: hasCodeReviewBeta,
      has_legacy_seer: hasLegacySeer,
      has_seat_based_seer: hasSeatBasedSeer,
    };
  }, [canWrite, hasSeatBasedSeer, hasLegacySeer, hasCodeReviewBeta]);

  const {
    isPending,
    isError,
    data: data,
  } = useQuery(getSeerOnboardingCheckQueryOptions({organization, staleTime: 60_000}));

  if (!canWrite || !hasSeatBasedSeer || isPending || isError) {
    return {canSeeReminder: false, analyticsParams, title: null, description: null};
  }
  const {hasSupportedScmIntegration, isAutofixEnabled, isCodeReviewEnabled} = data;

  if (!hasSupportedScmIntegration) {
    return {
      canSeeReminder: true,
      analyticsParams,
      title: t('Connect GitHub'),
      description: t(
        'Seer is enabled, but Github is not connected. Connect your GitHub account to enable Autofix and Code Review.'
      ),
    };
  }

  if (!isAutofixEnabled) {
    return {
      canSeeReminder: true,
      analyticsParams,
      title: (
        <Flex align="center" gap="sm">
          <IconSeer />
          {t('Start using Autofix')}
        </Flex>
      ),
      description: t(
        'Seer is enabled but projects are not connected to repos. Connect your source code and run Root Cause Analysis, Solution generation, and PR creation.'
      ),
    };
  }

  if (!isCodeReviewEnabled) {
    return {
      canSeeReminder: true,
      analyticsParams,
      title: (
        <Flex align="center" gap="sm">
          <IconSeer />
          {t('Start using Code Review')}
        </Flex>
      ),
      description: t(
        'Seer is enabled but Code Review is not configured. Configure Seer to automatically review PRs and flag potential issues.'
      ),
    };
  }

  return {canSeeReminder: false, analyticsParams, title: null, description: null};
}

export function PrimaryNavSeerConfigReminder() {
  const organization = useOrganization();
  const {
    isOpen,
    triggerProps: overlayTriggerProps,
    overlayProps,
    state,
  } = usePrimaryNavigationButtonOverlay();

  const {canSeeReminder, title, description, analyticsParams} = useReminderData();

  useEffect(() => {
    if (canSeeReminder) {
      trackAnalytics('seer.config_reminder.rendered', {
        organization,
        ...analyticsParams,
      });
    }
  }, [canSeeReminder, analyticsParams, organization]);

  if (!canSeeReminder) {
    return null;
  }

  return (
    <Fragment>
      <PrimaryNavigation.Button
        analyticsKey="seer-config-reminder"
        analyticsParams={analyticsParams}
        label={t('Configure Seer')}
        indicator="accent"
        buttonProps={{
          ...overlayTriggerProps,
          icon: <IconSeer />,
        }}
      />
      {isOpen && (
        <PrimaryNavigation.ButtonOverlay overlayProps={overlayProps}>
          <Stack gap="xl">
            <Heading as="h3">{title}</Heading>
            <Text>{description}</Text>
            <Flex justify="start">
              <LinkButton
                size="sm"
                to={`/settings/${organization.slug}/seer/`}
                priority="primary"
                onClick={() => state.close()}
                analyticsEventName="Seer Config Reminder: Configure Now Clicked"
                analyticsParams={analyticsParams}
              >
                {t('Configure Now')}
              </LinkButton>
            </Flex>
          </Stack>
        </PrimaryNavigation.ButtonOverlay>
      )}
    </Fragment>
  );
}
