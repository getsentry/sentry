import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout/flex';
import {ExternalLink} from 'sentry/components/core/link';
import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TextOverflow from 'sentry/components/textOverflow';
import {CONSOLE_PLATFORM_METADATA} from 'sentry/constants/consolePlatforms';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {useConsoleSdkInvites, useRevokeConsoleSdkPlatformInvite} from './hooks';

export default function ConsoleSDKInvitesSettings() {
  const organization = useOrganization();

  const {
    data: invites,
    isPending,
    isError,
    refetch,
  } = useConsoleSdkInvites(organization.slug);
  const {mutate: revokePlatformInvite, isPending: isRevoking} =
    useRevokeConsoleSdkPlatformInvite();

  const userHasConsoleAccess = (organization.enabledConsolePlatforms?.length ?? 0) > 0;
  const userHasQuotaRemaining =
    !isPending &&
    !isError &&
    organization.consoleSdkInviteQuota !== undefined &&
    organization.consoleSdkInviteQuota > 0 &&
    organization.consoleSdkInviteQuota > (invites?.length ?? 0);

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Console SDK Invites')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Console SDK Invites')}
        action={
          <Tooltip
            title={getTooltipText(userHasConsoleAccess, userHasQuotaRemaining)}
            disabled={
              isPending || isError || (userHasConsoleAccess && userHasQuotaRemaining)
            }
          >
            <RequestSdkAccessButton
              disabled={!(userHasConsoleAccess && userHasQuotaRemaining)}
              organization={organization}
              origin="org-settings"
            />
          </Tooltip>
        }
      />
      <TextBlock>
        {t('Manage invitations to our private gaming console SDK GitHub repositories.')}
      </TextBlock>
      {!userHasConsoleAccess && <NoAccessAlert />}
      {!isPending && userHasConsoleAccess && !userHasQuotaRemaining && (
        <NoQuotaRemaining organization={organization} />
      )}
      <InvitesTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Email')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Platforms')}</SimpleTable.HeaderCell>
        </SimpleTable.Header>

        {isPending && (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        )}

        {isError && (
          <SimpleTable.Empty>
            <LoadingError onRetry={refetch} />
          </SimpleTable.Empty>
        )}

        {!isPending && !isError && invites?.length === 0 && (
          <SimpleTable.Empty>{t('No invites found')}</SimpleTable.Empty>
        )}

        {invites?.map(invite => (
          <SimpleTable.Row key={invite.user_id}>
            <SimpleTable.RowCell>
              <TextOverflow>{invite.email}</TextOverflow>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Flex gap="xs" wrap="wrap">
                {invite.platforms.map(platform => (
                  <Tag
                    variant="info"
                    key={platform}
                    onDismiss={() => {
                      if (isRevoking) {
                        return;
                      }
                      revokePlatformInvite({
                        userId: invite.user_id,
                        email: invite.email,
                        platform,
                        orgSlug: organization.slug,
                      });
                    }}
                  >
                    {CONSOLE_PLATFORM_METADATA[platform]?.displayName ?? platform}
                  </Tag>
                ))}
              </Flex>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </InvitesTable>
    </Fragment>
  );
}

function getTooltipText(userHasConsoleAccess: boolean, userHasQuotaRemaining: boolean) {
  if (!userHasConsoleAccess) {
    return t('Your organization does not have any console platforms enabled');
  }
  if (!userHasQuotaRemaining) {
    return t('Your organization does not have any invites remaining');
  }
  return '';
}

function NoAccessAlert() {
  return (
    <Alert.Container>
      <Alert variant="warning" showIcon={false}>
        {t(
          'Your organization does not have any console platforms enabled. Please complete the middleware verification process for your platform:'
        )}
        <List symbol="bullet">
          <ListItem>
            <ExternalLink href="https://game.develop.playstation.net/tm/verify/functionalsw">
              {t('PlayStation Partners')}
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://developer.nintendo.com/group/development/getting-started/g1kr9vj6/middleware/sentry">
              {t('Nintendo Developer Portal')}
            </ExternalLink>
          </ListItem>
          <ListItem>
            <ExternalLink href="https://developer.microsoft.com/en-us/games/support/request-gdkx-middleware">
              {t('Microsoft GDK Middleware')}
            </ExternalLink>
          </ListItem>
        </List>
      </Alert>
    </Alert.Container>
  );
}

function NoQuotaRemaining({organization}: {organization: Organization}) {
  return (
    <Alert.Container>
      <Alert variant="info" showIcon={false}>
        {tct(
          'This organization ([orgSlug]) has used all GitHub invites available. [mailto:Contact support] to increase the quota.',
          {
            orgSlug: organization.slug,
            mailto: <a href="mailto:support@sentry.io" />,
          }
        )}
      </Alert>
    </Alert.Container>
  );
}

const InvitesTable = styled(SimpleTable)`
  margin-top: 1em;
  grid-template-columns: 1fr 2fr;
`;
