import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SCM_MESSAGING_PROVIDER_DESCRIPTIONS} from 'sentry/components/onboarding/scm/messagingProviders';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {ScmMessagingResolvedProvider} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {t} from 'sentry/locale';

import type {RowVisualState} from './types';

export function RowSubtitle({
  visualState,
  resolvedProvider,
  messagingSetup,
}: {
  messagingSetup: ScmMessagingSetup;
  resolvedProvider: ScmMessagingResolvedProvider;
  visualState: RowVisualState;
}) {
  if (
    visualState === 'installable' ||
    visualState === 'loading' ||
    visualState === 'installing' ||
    visualState === 'choose-destination'
  ) {
    return (
      <Text variant="muted" size="sm">
        {SCM_MESSAGING_PROVIDER_DESCRIPTIONS[resolvedProvider.providerKey]}
      </Text>
    );
  }

  if (visualState === 'install-forbidden') {
    return (
      <Stack gap="2xs">
        <Text variant="muted" size="sm">
          {SCM_MESSAGING_PROVIDER_DESCRIPTIONS[resolvedProvider.providerKey]}
        </Text>
        <Text variant="muted" size="sm">
          {t('Ask an organization admin to connect %s.', resolvedProvider.provider.name)}
        </Text>
      </Stack>
    );
  }

  if (visualState === 'permission-limited') {
    const permissionLimitedMessage =
      resolvedProvider.providerKey === 'msteams'
        ? t(
            'This Microsoft Teams workspace uses a tenant-level connection and cannot receive issue alerts directly. Reinstall with a team-level connection to enable destinations.'
          )
        : t(
            'This integration does not have the required permissions to receive issue alerts.'
          );

    return (
      <Stack gap="2xs">
        <Text size="sm">{resolvedProvider.permissionLimitedIntegration?.name}</Text>
        <Text variant="muted" size="sm">
          {permissionLimitedMessage}
        </Text>
      </Stack>
    );
  }

  if (visualState === 'configured' && messagingSetup.mode === 'selected') {
    return (
      <Flex gap="xs" align="center">
        <Text size="sm">
          {
            resolvedProvider.eligibleIntegrations.find(
              i => i.id === messagingSetup.integrationId
            )?.name
          }
        </Text>
        <Text variant="muted" size="sm" aria-hidden>
          /
        </Text>
        <Text size="sm">{messagingSetup.channelName}</Text>
      </Flex>
    );
  }

  if (visualState === 'removing' && messagingSetup.mode === 'selected') {
    return (
      <Text variant="muted" size="sm">
        {t(
          'This removes the destination from project setup. The integration stays connected to your organization.'
        )}
      </Text>
    );
  }

  return null;
}
