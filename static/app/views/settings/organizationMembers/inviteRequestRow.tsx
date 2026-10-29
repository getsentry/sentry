import {Fragment} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconClose} from '@sentry/icons/close';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Confirm} from 'sentry/components/confirm';
import type {InviteModalRenderFunc} from 'sentry/components/modals/memberInviteModalCustomization';
import {InviteModalHook} from 'sentry/components/modals/memberInviteModalCustomization';
import {RoleSelectControl} from 'sentry/components/roleSelectControl';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TeamSelector} from 'sentry/components/teamSelector';
import {t, tct} from 'sentry/locale';
import type {Member, Organization, OrgRole} from 'sentry/types/organization';

type Props = {
  allRoles: OrgRole[];
  inviteRequest: Member;
  inviteRequestBusy: Record<string, boolean>;
  onApprove: (inviteRequest: Member) => void;
  onDeny: (inviteRequest: Member) => void;
  onUpdate: (data: Partial<Member>) => void;
  organization: Organization;
};

export function InviteRequestRow({
  inviteRequest,
  inviteRequestBusy,
  organization,
  onApprove,
  onDeny,
  onUpdate,
  allRoles,
}: Props) {
  const role = allRoles.find(r => r.id === inviteRequest.role);
  const roleDisallowed = !role?.isAllowed;
  const {access} = organization;
  const canApprove = access.includes('member:admin');

  const renderApproveButton: InviteModalRenderFunc = ({
    sendInvites,
    canSend,
    headerInfo,
  }) => (
    <Confirm
      onConfirm={sendInvites}
      disableConfirmButton={!canSend}
      disabled={!canApprove || roleDisallowed}
      message={
        <Fragment>
          {tct('Are you sure you want to invite [email] to your organization?', {
            email: inviteRequest.email,
          })}
          {headerInfo}
        </Fragment>
      }
    >
      <Button
        variant="primary"
        size="sm"
        busy={inviteRequestBusy[inviteRequest.id]}
        tooltipProps={{
          title: canApprove
            ? roleDisallowed
              ? t(
                  `You do not have permission to approve a user of this role.
                      Select a different role to approve this user.`
                )
              : undefined
            : t('This request needs to be reviewed by a privileged user'),
        }}
        icon={<IconCheckmark />}
      >
        {t('Approve')}
      </Button>
    </Confirm>
  );

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell direction="column" align="start" gap="xs">
        <Text wordBreak="break-word">{inviteRequest.email}</Text>
        {inviteRequest.inviteStatus === 'requested_to_be_invited' ? (
          inviteRequest.inviterName && (
            <InfoText
              variant="muted"
              title={t(
                'An existing member has asked to invite this user to your organization'
              )}
            >
              {tct('Requested by [inviterName]', {
                inviterName: inviteRequest.inviterName,
              })}
            </InfoText>
          )
        ) : (
          <Tag
            variant="muted"
            title={t('This user has asked to join your organization.')}
          >
            {t('Join request')}
          </Tag>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell>
        {canApprove ? (
          <Container flex="1" minWidth={0}>
            <RoleSelectControl
              name="role"
              disableUnallowed
              onChange={r => onUpdate({role: r.value})}
              value={inviteRequest.role}
              roles={allRoles}
              aria-label={t('Role: %s', role?.name)}
              menuPortalTarget={document.body}
            />
          </Container>
        ) : (
          <Text wordBreak="break-word">{inviteRequest.roleName}</Text>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell>
        {canApprove ? (
          <Container flex="1" minWidth={0}>
            <TeamSelector
              name="teams"
              placeholder={t('None')}
              onChange={(teams: any) =>
                onUpdate({teams: (teams || []).map((team: any) => team.value)})
              }
              value={inviteRequest.teams}
              clearable
              multiple
              menuPortalTarget={document.body}
            />
          </Container>
        ) : (
          <Text wordBreak="break-word">{inviteRequest.teams.join(', ')}</Text>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end" gap="md">
        <Button
          size="sm"
          busy={inviteRequestBusy[inviteRequest.id]}
          onClick={() => onDeny(inviteRequest)}
          icon={<IconClose />}
          disabled={!canApprove}
          tooltipProps={{
            title: canApprove
              ? undefined
              : t('This request needs to be reviewed by a privileged user'),
          }}
        >
          {t('Deny')}
        </Button>
        <InviteModalHook
          willInvite
          organization={organization}
          onSendInvites={() => onApprove(inviteRequest)}
        >
          {renderApproveButton}
        </InviteModalHook>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
