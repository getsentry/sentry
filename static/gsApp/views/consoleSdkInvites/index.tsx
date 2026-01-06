import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {RequestSdkAccessButton} from 'sentry/components/gameConsole/RequestSdkAccessButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {
  useConsoleSdkInvites,
  useRevokeConsoleSdkInvite,
} from 'getsentry/views/consoleSdkInvites/hooks';

function ConsoleSDKInvitesSettings() {
  const organization = useOrganization();

  const {data: invites, isPending} = useConsoleSdkInvites(organization.slug);
  const {mutate: revokeInvite} = useRevokeConsoleSdkInvite();

  if ((organization.enabledConsolePlatforms?.length ?? 0) === 0) {
    return (
      <Alert variant="warning">
        {t(
          'Your organization does not have any console platforms enabled. Please contact your sales representative to enable console SDK access.'
        )}
      </Alert>
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Console SDK Invites')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Console SDK Invites')}
        action={
          <RequestSdkAccessButton
            organization={organization}
            origin="org-settings"
            projectId="None"
          />
        }
      />
      <TextBlock>
        {t('Manage invitations to our private gaming console SDK GitHub repositories.')}
      </TextBlock>
      {!isPending &&
        organization.consoleSdkInviteQuota !== undefined &&
        organization.consoleSdkInviteQuota > 0 &&
        organization.consoleSdkInviteQuota <= (invites?.length ?? 0) && (
          <Alert variant="info">
            {tct(
              'This organization ([orgSlug]) has used all GitHub invites available. Contact your sales representative to increase the quota.',
              {
                orgSlug: organization.slug,
              }
            )}
          </Alert>
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
            <SimpleTable.RowCell>{invite.email}</SimpleTable.RowCell>
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

export default ConsoleSDKInvitesSettings;
