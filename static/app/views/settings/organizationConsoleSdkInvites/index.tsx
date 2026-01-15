import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout/flex';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {CONSOLE_PLATFORM_METADATA} from 'sentry/constants/consolePlatforms';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {useConsoleSdkInvites, useRevokeConsoleSdkPlatformInvite} from './hooks';

export default function ConsoleSDKInvitesSettings() {
  const organization = useOrganization();
  const user = useUser();

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
            title={t('Your organization does not have any console platforms enabled')}
            disabled={isPending || isError || userHasConsoleAccess}
          >
            <RequestSdkAccessButton
              disabled={isPending || isError || !userHasConsoleAccess}
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
      {!isPending && !isError && userHasConsoleAccess && !userHasQuotaRemaining && (
        <NoQuotaRemaining organization={organization} />
      )}
      <InvitesTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Users')}</SimpleTable.HeaderCell>
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
              <Link to={`/settings/${organization.slug}/members/${invite.user_id}/`}>
                <Text wordBreak="break-all">{invite.email}</Text>
              </Link>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Flex gap="xs" wrap="wrap">
                {invite.platforms.map(platform => {
                  const canManageAllInvites = ['admin', 'manager', 'owner'].includes(
                    organization.orgRole ?? ''
                  );
                  const canManageInvite =
                    canManageAllInvites || invite.email === user.email;
                  const displayName =
                    CONSOLE_PLATFORM_METADATA[platform]?.displayName ?? platform;

                  if (canManageInvite) {
                    return (
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
                        {displayName}
                      </Tag>
                    );
                  }

                  return (
                    <Tooltip
                      key={platform}
                      title={t('Organization members can only manage their own invites')}
                    >
                      <Tag variant="muted" style={{cursor: 'not-allowed'}}>
                        {displayName}
                      </Tag>
                    </Tooltip>
                  );
                })}
              </Flex>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </InvitesTable>
    </Fragment>
  );
}

function NoAccessAlert() {
  return (
    <Alert.Container>
      <Alert variant="warning">
        {tct(
          'Your organization does not have any console platforms enabled. Please complete the middleware verification process for [playstation], [nintendo], or [xbox].',
          {
            playstation: (
              <ExternalLink href="https://game.develop.playstation.net/tm/verify/functionalsw">
                {t('PlayStation')}
              </ExternalLink>
            ),
            nintendo: (
              <ExternalLink href="https://developer.nintendo.com/group/development/getting-started/g1kr9vj6/middleware/sentry">
                {t('Nintendo Switch')}
              </ExternalLink>
            ),
            xbox: (
              <ExternalLink href="https://developer.microsoft.com/en-us/games/support/request-gdkx-middleware">
                {t('Xbox')}
              </ExternalLink>
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}

function NoQuotaRemaining({organization}: {organization: Organization}) {
  return (
    <Alert.Container>
      <Alert variant="info">
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
