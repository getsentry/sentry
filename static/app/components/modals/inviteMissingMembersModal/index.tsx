import {Fragment, useCallback, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {closeModal} from 'sentry/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import Checkbox from 'sentry/components/checkbox';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import {NormalizedInvite} from 'sentry/components/modals/inviteMembersModal/types';
import {MissingMemberInvite} from 'sentry/components/modals/inviteMissingMembersModal/types';
import PanelItem from 'sentry/components/panels/panelItem';
import PanelTable, {
  PanelTableHeader,
  PanelTableProps,
} from 'sentry/components/panels/panelTable';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import TeamSelector from 'sentry/components/teamSelector';
import {Tooltip} from 'sentry/components/tooltip';
import {ORG_ROLES} from 'sentry/constants';
import {IconCommit, IconEllipsis, IconGithub, IconInfo, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MissingMember, Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import {OrganizationAuthTokensNewAuthToken} from 'sentry/views/settings/organizationAuthTokens/newAuthToken';
import {
  MemberCardContentRow,
  StyledExternalLink,
  Subtitle,
} from 'sentry/views/settings/organizationMembers/inviteBanner';

type Props = {
  missingMembers: {integration: string; users: MissingMember[]};
  onSendInvite: (email: string) => void;
  organization: Organization;
};

export function InviteMissingMembersModal({
  missingMembers,
  onSendInvite,
  organization,
}: Props) {
  const start = missingMembers?.users.map(member => ({
    email: member.email,
    commitCount: member.commitCount,
    role: organization.defaultRole,
    teams: new Set<string>(),
    userId: member.userId,
  }));
  const [members, setMembers] = useState<MissingMemberInvite[]>(start);
  const [selectedMembers, setSelectedMembers] = useState<MissingMemberInvite[]>([]);

  const setRole = (role: string, index: number) => {
    setMembers(
      members.map((member, i) => {
        if (i === index) {
          member.role = role;
        }
        return member;
      })
    );
  };

  const setTeams = (teams: string[], index: number) => {
    setMembers(
      members.map((member, i) => {
        if (i === index) {
          member.teams = new Set(teams);
        }
        return member;
      })
    );
  };

  const selectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(start);
    } else {
      setSelectedMembers([]);
    }
  };

  const checkboxToggle = (checked: boolean, index: number) => {
    if (checked) {
      setSelectedMembers(
        members.filter((member, i) => selectedMembers.includes(member) || index === i)
      );
    } else {
      setSelectedMembers(
        members.filter((member, i) => selectedMembers.includes(member) && index !== i)
      );
    }
  };

  return (
    <Fragment>
      <h4>{t('Invite Your Dev Team')}</h4>
      <StyledPanelTable
        headers={[
          <div key={0}>
            <Checkbox
              key={0}
              onChange={() => selectAll(start.length !== selectedMembers.length)}
              checked={start.length === selectedMembers.length}
            />
          </div>,
          t('User Information'),
          <StyledHeader key={1}>
            {t('Recent Commits')}{' '}
            <Tooltip title={t('Based on the last 30 days of commit data')}>
              <IconInfo size="xs" />
            </Tooltip>
          </StyledHeader>,
          t('Role'),
          t('Team'),
        ]}
      >
        {members?.map((member, i) => {
          const checked = selectedMembers.some(
            selectedMember => selectedMember.email === member.email
          );
          return (
            <Fragment key={i}>
              <div>
                <Checkbox
                  checked={checked}
                  onChange={() => checkboxToggle(!checked, i)}
                />
              </div>
              <StyledPanelItem>
                <MemberCardContentRow>
                  <IconGithub size="sm" />
                  <StyledExternalLink href={`http://github.com/${member.userId}`}>
                    {tct('@[userId]', {userId: member.userId})}
                  </StyledExternalLink>
                </MemberCardContentRow>
                <Subtitle>{member.email}</Subtitle>
              </StyledPanelItem>
              <MemberCardContentRow>
                <IconCommit size="xs" />
                {member.commitCount}
              </MemberCardContentRow>
              <RoleSelectControl
                aria-label={t('Role')}
                data-test-id="select-role"
                disabled={false}
                roles={ORG_ROLES}
                disableUnallowed
                onChange={value => setRole(value?.value, i)}
              />
              <TeamSelector
                aria-label={t('Add to Team')}
                data-test-id="select-teams"
                disabled={false}
                placeholder={t('Add to teams\u2026')}
                onChange={opts => setTeams(opts ? opts.map(v => v.value) : [], i)}
                multiple
                clearable
              />
            </Fragment>
          );
        })}
      </StyledPanelTable>
      <ButtonContainer>
        <Button size="sm" onClick={() => closeModal()} style={{marginRight: space(1)}}>
          {t('Cancel')}
        </Button>
        <Button
          size="sm"
          priority="primary"
          onClick={() => closeModal()}
          style={{marginRight: space(1)}}
        >
          {tct('Invite [memberCount] missing members', {
            memberCount:
              members.length === selectedMembers.length
                ? `all ${selectedMembers.length}`
                : selectedMembers.length,
          })}
        </Button>
      </ButtonContainer>
    </Fragment>
  );
}

// export function MissingMemberRow({member, onChangeRole});

export default withOrganization(InviteMissingMembersModal);

const StyledPanelTable = styled(PanelTable)`
  /* min-width: 868px; */
  /* TODO(cathy): how to make the modal bigger? */
`;

const StyledHeader = styled('div')`
  display: flex;
  & > *:first-child {
    margin-left: ${space(0.5)};
  }
`;

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const ButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

// const StyledCard = styled(Card)`
//   padding: ${space(2)};
//   display: flex;
//   overflow: hidden;
// `;

// const CardTitleContainer = styled('div')`
//   display: flex;
//   justify-content: space-between;
// `;

// const CardTitleContent = styled('div')`
//   display: flex;
//   flex-direction: column;
// `;

// const CardTitle = styled('div')`
//   font-size: ${p => p.theme.fontSizeLarge};
//   font-weight: bold;
//   color: ${p => p.theme.gray400};
// `;

// const Subtitle = styled('div')`
//   font-size: ${p => p.theme.fontSizeSmall};
//   font-weight: 400;
//   color: ${p => p.theme.gray300};
//   display: flex;
//   align-items: center;
//   & > *:first-child {
//     margin-left: ${space(0.5)};
//     display: flex;
//     align-items: center;
//   }
// `;

// const ButtonContainer = styled('div')`
//   display: grid;
//   grid-auto-flow: column;
//   grid-column-gap: ${space(1)};
// `;

// const MemberCard = styled(Card)`
//   padding: ${space(2)} 18px;
//   display: flex;
//   flex-direction: row;
//   align-items: center;
//   margin: ${space(1)} ${space(0.5)} 0 0;
//   min-width: 330px;
//   justify-content: space-between;
// `;

// const MemberCardsContainer = styled('div')`
//   display: flex;
//   overflow-x: scroll;
// `;

// const MemberCardContent = styled('div')`
//   display: flex;
//   flex-direction: column;
//   width: 75%;
// `;

// const MemberCardContentRow = styled('div')`
//   display: flex;
//   align-items: center;
//   font-size: ${p => p.theme.fontSizeSmall};
//   & > *:first-child {
//     margin-right: ${space(0.75)};
//   }
//   margin-bottom: ${space(0.25)};
// `;

// const StyledExternalLink = styled(ExternalLink)`
//   font-size: ${p => p.theme.fontSizeMedium};
// `;

// const SeeMoreContainer = styled('div')`
//   font-size: ${p => p.theme.fontSizeLarge};
// `;
