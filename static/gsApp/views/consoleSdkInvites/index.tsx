import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {openPrivateGamingSdkAccessModal} from 'sentry/actionCreators/modal';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {PrivateGamingSdkAccessModalProps} from 'sentry/components/modals/privateGamingSdkAccessModal';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import {useReopenGamingSdkModal} from 'sentry/utils/useReopenGamingSdkModal';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import {
  useConsoleSdkInvites,
  useRevokeConsoleSdkInvite,
} from 'getsentry/views/consoleSdkInvites/hooks';

function ConsoleSDKInviteButton({organization}: {organization: Organization}) {
  const buttonProps: PrivateGamingSdkAccessModalProps = useMemo(
    () => ({
      projectId: 'Console SDK invites settings page',
      projectSlug: 'Console SDK invites settings page',
      sdkName: 'Console SDK invites settings page',
      organization,
      origin: 'onboarding',
    }),
    [organization]
  );

  useReopenGamingSdkModal(buttonProps);

  return (
    <Button
      priority="primary"
      onClick={() => openPrivateGamingSdkAccessModal(buttonProps)}
    >
      {t('Get Console SDK access')}
    </Button>
  );
}

function ConsoleSDKInvitesSettings() {
  const organization = useOrganization();

  const {data: invites, isPending} = useConsoleSdkInvites(organization.slug);
  const {mutate: revokeInvite} = useRevokeConsoleSdkInvite();

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Console SDK Invites')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Console SDK Invites')}
        action={ConsoleSDKInviteButton({organization})}
      />
      <Alert type="info">
        {tct(
          'Currently this organization "[orgSlug]" can invite [quota] GitHub users to our Console SDK GitHub repositories',
          {
            orgSlug: organization.slug,
            quota: organization.consoleSdkInviteQuota,
          }
        )}
      </Alert>
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
