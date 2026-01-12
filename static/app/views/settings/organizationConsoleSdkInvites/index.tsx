import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TextOverflow from 'sentry/components/textOverflow';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {useConsoleSdkInvites, useRevokeConsoleSdkInvite} from './hooks';

export default function ConsoleSDKInvitesSettings() {
  const organization = useOrganization();

  const {data: invites, isPending} = useConsoleSdkInvites(organization.slug);
  const {mutate: revokeInvite} = useRevokeConsoleSdkInvite();

  if ((organization.enabledConsolePlatforms?.length ?? 0) === 0) {
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

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Console SDK Invites')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Console SDK Invites')}
        action={
          <RequestSdkAccessButton organization={organization} origin="org-settings" />
        }
      />
      <TextBlock>
        {t('Manage invitations to our private gaming console SDK GitHub repositories.')}
      </TextBlock>
      {!isPending &&
        organization.consoleSdkInviteQuota !== undefined &&
        organization.consoleSdkInviteQuota > 0 &&
        organization.consoleSdkInviteQuota <= (invites?.length ?? 0) && (
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
        )}
      <InvitesTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Email')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Repository')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.Header>

        {isPending && (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        )}

        {!isPending && invites?.length === 0 && (
          <SimpleTable.Empty>{t('No invites found')}</SimpleTable.Empty>
        )}

        {invites?.map(invite => (
          <SimpleTable.Row key={invite.user_id}>
            <SimpleTable.RowCell>
              <TextOverflow>{invite.email}</TextOverflow>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>{invite.platforms.join(', ')}</SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Button
                size="sm"
                icon={<IconDelete />}
                onClick={() =>
                  revokeInvite({
                    userId: invite.user_id,
                    email: invite.email,
                    orgSlug: organization.slug,
                  })
                }
              >
                {t('Revoke')}
              </Button>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </InvitesTable>
    </Fragment>
  );
}

const InvitesTable = styled(SimpleTable)`
  margin-top: 1em;
  grid-template-columns: 2fr 2fr max-content;
`;
