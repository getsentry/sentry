import type {ReactNode} from 'react';
import {IconLink} from '@sentry/icons/link';
import {IconSentry} from '@sentry/icons/sentry';

import sentryCliIcon from 'sentry-images/oauth/sentry-cli.png';
import sentryMcpIcon from 'sentry-images/oauth/sentry-mcp.png';

import {Avatar} from '@sentry/scraps/avatar';
import {Badge} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

import {PermissionTable} from './permissionTable';
import type {OAuthContext} from './types';

// OAuth apps belong to user accounts and have no icon or Sentry ownership metadata.
// Match known client IDs here to supply first-party branding until the model supports it.
const SENTRY_APPLICATIONS = new Map<string, {icon: ReactNode}>([
  [
    '1d673b81d60ef84c951359c36296972ca6fd41bd8f45acd2d3a783a3b3c28e41',
    {
      icon: (
        <Avatar
          type="upload"
          uploadUrl={sentryCliIcon}
          identifier="sentry-cli"
          name="Sentry CLI"
          size={32}
        />
      ),
    },
  ],
  [
    '32d744a577ea363284b996867923fa4eb0bfdfcfe6b46399f078f753b7bb84f1',
    {
      icon: (
        <Avatar
          type="upload"
          uploadUrl={sentryMcpIcon}
          identifier="sentry-mcp"
          name="Sentry MCP"
          size={32}
        />
      ),
    },
  ],
]);

export function ApplicationSummary({
  context,
  userCode,
}: {
  context: OAuthContext;
  userCode?: string;
}) {
  const {application, permissionGroups} = context;
  const sentryApplication = SENTRY_APPLICATIONS.get(application.clientId);
  const homepageOrigin =
    application.homepageUrl && URL.canParse(application.homepageUrl)
      ? new URL(application.homepageUrl).origin
      : null;

  return (
    <Stack border="secondary" radius="md" overflow="hidden">
      <Flex align="center" gap="md" padding="lg">
        {sentryApplication ? (
          <Flex
            position="relative"
            width="32px"
            height="32px"
            align="center"
            justify="center"
            flexShrink={0}
          >
            {sentryApplication.icon}
          </Flex>
        ) : (
          <Avatar
            type="letter_avatar"
            identifier={application.clientId}
            name={application.name}
            size={32}
          />
        )}
        <Stack gap="2xs" flex="1" minWidth="0">
          <Flex align="center" gap="sm" width="fit-content" maxWidth="100%">
            <Text bold ellipsis>
              {application.name}
            </Text>
            {sentryApplication && (
              <Tooltip skipWrapper title={t('This app is built by Sentry.')}>
                <Badge
                  variant="success"
                  role="img"
                  aria-label={t('Sentry app')}
                  tabIndex={0}
                >
                  <IconSentry size="xs" aria-hidden="true" />
                </Badge>
              </Tooltip>
            )}
          </Flex>
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
