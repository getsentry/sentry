import {useCallback, useEffect, useState} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {MultiValueProps} from 'sentry/components/forms/controls/reactSelectWrapper';
import type {StylesConfig} from 'sentry/components/forms/controls/selectControl';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import {useInviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import RoleSelectControl from 'sentry/components/roleSelectControl';
import TeamSelector from 'sentry/components/teamSelector';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {Organization, OrgRole} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

import EmailValue from './emailValue';
import type {InviteStatus} from './types';

type SelectOption = SelectValue<string>;

type Props = {
  roleDisabledUnallowed: boolean;
  roleOptions: OrgRole[];
};

function mapToOptions(values: string[]): SelectOption[] {
  return values.map(value => ({value, label: value}));
}

// If Member Invites are enabled but Open Membership is disabled, only allow members to invite to teams they are a member of
function orgOnlyAllowsMemberInvitesWithinTeam(organization: Organization): boolean {
  const isMemberInvite =
    organization.access?.includes('member:invite') &&
    !organization.access?.includes('member:admin');
  const membersCanOnlyInviteMemberTeams =
    organization.allowMemberInvite && !organization.openMembership;
  return isMemberInvite && membersCanOnlyInviteMemberTeams;
}

function InviteRowControl({roleDisabledUnallowed, roleOptions}: Props) {
  const organization = useOrganization();
  const filterByUserMembership = orgOnlyAllowsMemberInvitesWithinTeam(organization);
  const {
    inviteStatus,
    isOverMemberLimit,
    pendingInvites,
    setEmails,
    setRole,
    setTeams,
    reset,
  } = useInviteMembersContext();
  const emails = [...(pendingInvites.emails ?? [])];
  const role = pendingInvites.role ?? '';
  const teams = [...(pendingInvites.teams ?? [])];

  const onChangeEmails = (opts: SelectOption[]) => {
    setEmails(opts?.map(v => v.value) ?? [], 0);
  };
  const onChangeRole = (value: SelectOption) => setRole(value?.value, 0);
  const onChangeTeams = (opts: SelectOption[]) =>
    setTeams(opts ? opts.map(v => v.value) : [], 0);

  const [inputValue, setInputValue] = useState('');

  const theme = useTheme();

  const isTeamRolesAllowedForRole = useCallback<(roleId: string) => boolean>(
    roleId => {
      const roleOptionsMap = roleOptions.reduce<Record<string, OrgRole>>(
        (rolesMap, roleOption) => ({...rolesMap, [roleOption.id]: roleOption}),
        {}
      );
      return roleOptionsMap[roleId]?.isTeamRolesAllowed ?? true;
    },
    [roleOptions]
  );
  const isTeamRolesAllowed = isTeamRolesAllowedForRole(role);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    switch (e.key) {
      case 'Enter':
      case ',':
      case ' ':
        e.preventDefault();
        handleInput(inputValue);
        setInputValue('');
        break;
      default:
      // do nothing.
    }
  };

  const handleInput = (input: string) => {
    const newEmails = input.trim() ? input.trim().split(/[\s,]+/) : [];
    if (newEmails.length > 0) {
      onChangeEmails([
        ...mapToOptions(emails),
        ...newEmails.map(email => ({label: email, value: email})),
      ]);
    }
  };

  useEffect(() => {
    if (isOverMemberLimit) {
      setRole('billing', 0);
      setTeams([], 0);
    }
  }, [isOverMemberLimit, setRole, setTeams]);

  return (
    <RowWrapper>
      <div>
        <Heading htmlFor="email-addresses">{t('Email addresses')}</Heading>
        <SelectControl
          id="email-addresses"
          aria-label={t('Email Addresses')}
          placeholder={t('Enter one or more emails')}
          inputValue={inputValue}
          value={emails}
          components={{
            MultiValue: (props: MultiValueProps<SelectOption>) => (
              <EmailValue status={inviteStatus[props.data.value]!} valueProps={props} />
            ),
            DropdownIndicator: () => null,
          }}
          options={mapToOptions(emails)}
          onBlur={(e: React.ChangeEvent<HTMLInputElement>) => {
            handleInput(e.target.value);
          }}
          styles={getStyles(theme, inviteStatus)}
          onInputChange={setInputValue}
          onKeyDown={handleKeyDown}
          onChange={onChangeEmails}
          multiple
          creatable
          clearable
          onClear={reset}
          menuIsOpen={false}
        />
      </div>
      <RoleTeamWrapper>
        <div>
          <Heading htmlFor="role">{t('Role')}</Heading>
          <RoleSelectControl
            id="role"
            aria-label={t('Role')}
            disabled={isOverMemberLimit}
            value={role}
            roles={roleOptions}
            disableUnallowed={roleDisabledUnallowed}
            onChange={roleOption => {
              onChangeRole(roleOption);
              if (!isTeamRolesAllowedForRole(roleOption.value)) {
                onChangeTeams([]);
              }
            }}
          />
        </div>
        <div>
          <Heading htmlFor="team">{t('Add to team')}</Heading>
          <TeamSelector
            id="team"
            aria-label={t('Add to Team')}
            disabled={!isTeamRolesAllowed}
            placeholder={isTeamRolesAllowed ? t('None') : t('Role cannot join teams')}
            value={isTeamRolesAllowed ? teams : []}
            onChange={onChangeTeams}
            useTeamDefaultIfOnlyOne
            filterByUserMembership={filterByUserMembership}
            multiple
            clearable
          />
        </div>
      </RoleTeamWrapper>
    </RowWrapper>
  );
}

/**
 * The email select control has custom selected item states as items
 * show their delivery status after the form is submitted.
 */
function getStyles(theme: Theme, inviteStatus: InviteStatus): StylesConfig {
  return {
    multiValue: (provided, {data}: MultiValueProps<SelectOption>) => {
      const status = inviteStatus[data.value];
      return {
        ...provided,
        ...(status?.error
          ? {
              color: theme.red400,
              border: `1px solid ${theme.red300}`,
              backgroundColor: theme.red100,
            }
          : {}),
      };
    },
    multiValueLabel: (provided, {data}: MultiValueProps<SelectOption>) => {
      const status = inviteStatus[data.value];
      return {
        ...provided,
        pointerEvents: 'all',
        ...(status?.error ? {color: theme.red400} : {}),
      };
    },
    multiValueRemove: (provided, {data}: MultiValueProps<SelectOption>) => {
      const status = inviteStatus[data.value];
      return {
        ...provided,
        ...(status?.error
          ? {
              borderLeft: `1px solid ${theme.red300}`,
              ':hover': {backgroundColor: theme.red100, color: theme.red400},
            }
          : {}),
      };
    },
  };
}

const Heading = styled('label')`
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const RowWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
`;

const RoleTeamWrapper = styled('div')`
  display: grid;
  gap: ${space(1.5)};
  grid-template-columns: 1fr 1fr;
  align-items: start;
`;

export default InviteRowControl;
