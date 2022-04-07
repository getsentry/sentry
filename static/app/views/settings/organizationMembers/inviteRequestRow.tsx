import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {MultiControlProps} from 'sentry/components/deprecatedforms/multiSelectControl';
import TeamSelector from 'sentry/components/forms/teamSelector';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {PanelItem} from 'sentry/components/panels';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import Tag from 'sentry/components/tag';
import Tooltip from 'sentry/components/tooltip';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Member, MemberRole, Organization} from 'sentry/types';

type Props = {
  allRoles: MemberRole[];
  inviteRequest: Member;
  inviteRequestBusy: {[key: string]: boolean};
  onApprove: (inviteRequest: Member) => void;
  onDeny: (inviteRequest: Member) => void;
  onUpdate: (data: Partial<Member>) => void;
  organization: Organization;
};

const InviteModalHook = HookOrDefault({
  hookName: 'member-invite-modal:customization',
  defaultComponent: ({onSendInvites, children}) =>
    children({sendInvites: onSendInvites, canSend: true}),
});

type InviteModalRenderFunc = React.ComponentProps<typeof InviteModalHook>['children'];
type OnChangeArgs = Parameters<NonNullable<MultiControlProps['onChange']>>[0];

const InviteRequestRow = ({
  inviteRequest,
  inviteRequestBusy,
  organization,
  onApprove,
  onDeny,
  onUpdate,
  allRoles,
}: Props) => {
  const role = allRoles.find(r => r.id === inviteRequest.role);
  const roleDisallowed = !(role && role.allowed);
  const {access} = organization;
  const canApprove = access.includes('member:admin');

  // eslint-disable-next-line react/prop-types
  const hookRenderer: InviteModalRenderFunc = ({sendInvites, canSend, headerInfo}) => (
    <StyledPanelItem>
      <div>
        <h5 style={{marginBottom: space(0.5)}}>
          <UserName>{inviteRequest.email}</UserName>
        </h5>
        {inviteRequest.inviteStatus === 'requested_to_be_invited' ? (
          inviteRequest.inviterName && (
            <Description>
              <Tooltip
                title={t(
                  'An existing member has asked to invite this user to your organization'
                )}
              >
                {tct('Requested by [inviterName]', {
                  inviterName: inviteRequest.inviterName,
                })}
              </Tooltip>
            </Description>
          )
        ) : (
          <JoinRequestIndicator
            tooltipText={t('This user has asked to join your organization.')}
          >
            {t('Join request')}
          </JoinRequestIndicator>
        )}
      </div>

      {canApprove ? (
        <StyledRoleSelectControl
          name="role"
          disableUnallowed
          onChange={r => onUpdate({role: r.value})}
          value={inviteRequest.role}
          roles={allRoles}
        />
      ) : (
        <div>{inviteRequest.roleName}</div>
      )}
      {canApprove ? (
        <TeamSelectControl
          name="teams"
          placeholder={t('Add to teams\u2026')}
          onChange={(teams: OnChangeArgs) =>
            onUpdate({teams: (teams || []).map(team => team.value)})
          }
          value={inviteRequest.teams}
          clearable
          multiple
        />
      ) : (
        <div>{inviteRequest.teams.join(', ')}</div>
      )}

      <ButtonGroup>
        <Button
          size="small"
          busy={inviteRequestBusy[inviteRequest.id]}
          onClick={() => onDeny(inviteRequest)}
          icon={<IconClose />}
          disabled={!canApprove}
          title={
            canApprove
              ? undefined
              : t('This request needs to be reviewed by a privileged user')
          }
        >
          {t('Deny')}
        </Button>
        <Confirm
          onConfirm={sendInvites}
          disableConfirmButton={!canSend}
          disabled={!canApprove || roleDisallowed}
          message={
            <React.Fragment>
              {tct('Are you sure you want to invite [email] to your organization?', {
                email: inviteRequest.email,
              })}
              {headerInfo}
            </React.Fragment>
          }
        >
          <Button
            priority="primary"
            size="small"
            busy={inviteRequestBusy[inviteRequest.id]}
            title={
              canApprove
                ? roleDisallowed
                  ? t(
                      `You do not have permission to approve a user of this role.
                      Select a different role to approve this user.`
                    )
                  : undefined
                : t('This request needs to be reviewed by a privileged user')
            }
            icon={<IconCheckmark />}
          >
            {t('Approve')}
          </Button>
        </Confirm>
      </ButtonGroup>
    </StyledPanelItem>
  );

  return (
    <InviteModalHook
      willInvite
      organization={organization}
      onSendInvites={() => onApprove(inviteRequest)}
    >
      {hookRenderer}
    </InviteModalHook>
  );
};

const JoinRequestIndicator = styled(Tag)`
  text-transform: uppercase;
`;

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: minmax(150px, auto) minmax(100px, 140px) 220px max-content;
  gap: ${space(2)};
  align-items: center;
`;

const UserName = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Description = styled('div')`
  display: block;
  color: ${p => p.theme.subText};
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledRoleSelectControl = styled(RoleSelectControl)`
  max-width: 140px;
`;

const TeamSelectControl = styled(TeamSelector)`
  max-width: 220px;
  .Select-value-label {
    max-width: 150px;
    word-break: break-all;
  }
`;

const ButtonGroup = styled('div')`
  display: inline-grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(1)};
`;

export default InviteRequestRow;
