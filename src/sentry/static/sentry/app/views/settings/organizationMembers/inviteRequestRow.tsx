import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Member, Organization, Team, MemberRole} from 'app/types';
import {PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import HookOrDefault from 'app/components/hookOrDefault';
import Tag from 'app/views/settings/components/tag';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import SelectControl from 'app/components/forms/selectControl';
import RoleSelectControl from 'app/components/roleSelectControl';

type Props = {
  inviteRequest: Member;
  inviteRequestBusy: {[key: string]: boolean};
  organization: Organization;
  onApprove: (inviteRequest: Member) => void;
  onDeny: (inviteRequest: Member) => void;
  onUpdate: (data: Partial<Member>) => void;
  allTeams: Team[];
  allRoles: MemberRole[];
};

const InviteModalHook = HookOrDefault({
  hookName: 'member-invite-modal:customization',
  defaultComponent: ({onSendInvites, children}) =>
    children({sendInvites: onSendInvites, canSend: true}),
});

type InviteModalRenderFunc = React.ComponentProps<typeof InviteModalHook>['children'];

const InviteRequestRow = ({
  inviteRequest,
  inviteRequestBusy,
  organization,
  onApprove,
  onDeny,
  onUpdate,
  allTeams,
  allRoles,
}: Props) => {
  const role = allRoles.find(r => r.id === inviteRequest.role);
  const roleDisallowed = !(role && role.allowed);

  // eslint-disable-next-line react/prop-types
  const hookRenderer: InviteModalRenderFunc = ({sendInvites, canSend, headerInfo}) => (
    <StyledPanelItem>
      <div>
        <h5 style={{marginBottom: '3px'}}>
          <UserName>{inviteRequest.email}</UserName>
        </h5>
        {inviteRequest.inviteStatus === 'requested_to_be_invited' ? (
          inviteRequest.inviterName && (
            <Tooltip
              title={t(
                'An existing member has asked to invite this user to your organization'
              )}
            >
              <Description>
                {tct('Requested by [inviterName]', {
                  inviterName: inviteRequest.inviterName,
                })}
              </Description>
            </Tooltip>
          )
        ) : (
          <Tooltip title={t('This user has asked to join your organization.')}>
            <JoinRequestIndicator size="small">{t('Join request')}</JoinRequestIndicator>
          </Tooltip>
        )}
      </div>
      <RoleSelectControl
        name="role"
        disableUnallowed
        onChange={r => onUpdate({role: r.value})}
        value={inviteRequest.role}
        roles={allRoles}
      />
      <SelectControl
        name="teams"
        placeholder={t('Add to teams...')}
        onChange={teams => onUpdate({teams: teams.map(team => team.value)})}
        value={inviteRequest.teams}
        options={allTeams.map(({slug}) => ({
          value: slug,
          label: `#${slug}`,
        }))}
        multiple
        clearable
      />
      <ButtonGroup>
        <Confirm
          onConfirm={sendInvites}
          disableConfirmButton={!canSend}
          disabled={roleDisallowed}
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
              roleDisallowed
                ? t(
                    `You do not have permission to approve a user of this role.
                     Select a different role to approve this user.`
                  )
                : undefined
            }
          >
            {t('Approve')}
          </Button>
        </Confirm>
        <Button
          size="small"
          busy={inviteRequestBusy[inviteRequest.id]}
          onClick={() => onDeny(inviteRequest)}
        >
          {t('Deny')}
        </Button>
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

InviteRequestRow.propTypes = {
  inviteRequest: PropTypes.shape({
    email: PropTypes.string,
    id: PropTypes.string,
    inviterName: PropTypes.string,
    inviteStatus: PropTypes.string,
    role: PropTypes.string,
    teams: PropTypes.arrayOf(PropTypes.string),
  }),
  onApprove: PropTypes.func,
  onDeny: PropTypes.func,
  inviteRequestBusy: PropTypes.object,
  allRoles: PropTypes.arrayOf(PropTypes.object),
  allTeams: PropTypes.arrayOf(PropTypes.object),
};

const JoinRequestIndicator = styled(Tag)`
  padding: ${space(0.5)} ${space(0.75)};
  font-size: 10px;
  text-transform: uppercase;
`;

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: auto 140px 180px max-content;
  grid-gap: ${space(2)};
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: auto 100px max-content;
  }
`;

const UserName = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  word-break: break-all;
`;

const Description = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: 14px;
`;

const ButtonGroup = styled('div')`
  display: inline-grid;
  grid-template-columns: auto auto;
  grid-gap: ${space(1)};
`;

export default InviteRequestRow;
