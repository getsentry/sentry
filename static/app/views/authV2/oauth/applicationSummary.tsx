import {IconLink} from '@sentry/icons/link';

import {Avatar} from '@sentry/scraps/avatar';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

import {PermissionTable} from './permissionTable';
import type {OAuthContext} from './types';

export function ApplicationSummary({
  context,
  userCode,
}: {
  context: OAuthContext;
  userCode?: string;
}) {
  const {application, permissionGroups} = context;
  const homepageOrigin =
    application.homepageUrl && URL.canParse(application.homepageUrl)
      ? new URL(application.homepageUrl).origin
      : null;

  return (
    <Stack border="secondary" radius="md" overflow="hidden">
      <Flex align="center" gap="md" padding="lg">
        <Avatar
          type="letter_avatar"
          identifier={application.clientId}
          name={application.name}
          size={32}
        />
        <Stack gap="2xs" flex="1" minWidth="0">
          <Text bold ellipsis>
            {application.name}
          </Text>
          {application.homepageUrl && homepageOrigin && (
            <Text size="xs" variant="muted">
              <ExternalLink href={application.homepageUrl}>{homepageOrigin}</ExternalLink>
            </Text>
          )}
        </Stack>
        {userCode && <DeviceCodeBadge userCode={userCode} />}
      </Flex>
      <PermissionTable groups={permissionGroups} />
    </Stack>
  );
}

function DeviceCodeBadge({userCode}: {userCode: string}) {
  return (
    <Tooltip
      skipWrapper
      title={t('Confirm that this code matches your device: %s', userCode)}
    >
      <Flex
        role="group"
        aria-label={t('Device code')}
        tabIndex={0}
        align="center"
        gap="xs"
        background="secondary"
        radius="md"
        padding="sm md"
      >
        <IconLink size="xs" variant="muted" aria-hidden="true" />
        <Text size="md" variant="muted" monospace wrap="nowrap">
          {userCode}
        </Text>
      </Flex>
    </Tooltip>
  );
}
