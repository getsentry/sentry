import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {
  CompactSelect,
  type SelectOption,
  type SelectSection,
} from 'sentry/components/core/compactSelect';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import type {RotationSchedule} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';
import {useFetchRotationSchedules} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';

export type AssignableEntity = {
  assignee: User | Actor | Team | RotationSchedule | any; // Using 'any' for schedule data to handle different formats
  type: 'user' | 'team' | 'schedule';
};

interface EscalationAssigneeSelectorProps {
  loading?: boolean;
  onAssigneeChange?: (assignee: AssignableEntity | null) => void;
  selectedAssignee?: AssignableEntity | null;
}

export default function EscalationAssigneeSelector({
  loading = false,
  onAssigneeChange,
  selectedAssignee,
}: EscalationAssigneeSelectorProps) {
  const api = useApi();
  const organization = useOrganization();
  const [memberList, setMemberList] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Fetch teams
  const {teams, onSearch, fetching: fetchingTeams} = useTeams();

  // Fetch schedules
  const {data: schedules = [], isPending: fetchingSchedules} = useFetchRotationSchedules(
    {orgSlug: organization.slug},
    {}
  );

  // Fetch members
  useState(() => {
    fetchOrgMembers(api, organization.slug).then(members => {
      const memberUsers =
        members
          ?.filter(({user}) => user)
          .map(({user}) => user)
          .filter((user): user is User => user !== null) || [];
      setMemberList(memberUsers);
      setLoadingMembers(false);
    });
  });

  const isLoading = loading || loadingMembers || fetchingTeams || fetchingSchedules;

  const assigneeOptions = useMemo(() => {
    const sections: Array<SelectSection<string>> = [];

    // Add users section
    if (memberList.length > 0) {
      sections.push({
        title: t('Users'),
        options: memberList.map(user => ({
          value: `user:${user.id}`,
          label: user.name || user.email,
          leadingItems: <UserAvatar user={user} size={20} />,
        })),
      });
    }

    // Add teams section
    if (teams.length > 0) {
      sections.push({
        title: t('Teams'),
        options: teams.map(team => ({
          value: `team:${team.id}`,
          label: `#${team.slug}`,
          leadingItems: <TeamAvatar team={team} size={20} />,
        })),
      });
    }

    // Add schedules section
    if (schedules.length > 0) {
      sections.push({
        title: t('Schedules'),
        options: schedules.map(schedule => ({
          value: `schedule:${schedule.id}`,
          label: schedule.name,
          leadingItems: <IconCalendar size="md" />,
        })),
      });
    }

    return sections;
  }, [memberList, teams, schedules]);

  const handleChange = (option: SelectOption<string>) => {
    if (!option.value) {
      onAssigneeChange?.(null);
      return;
    }

    const [type, id] = option.value.split(':');

    let assignee: AssignableEntity | null = null;

    if (type === 'user') {
      const user = memberList.find(i => i.id === id);
      if (user) {
        assignee = {type: 'user', assignee: user};
      }
    } else if (type === 'team') {
      const team = teams.find(i => i.id === id);
      if (team) {
        assignee = {type: 'team', assignee: team};
      }
    } else if (type === 'schedule') {
      const schedule = schedules.find(i => String(i.id) === id);
      if (schedule) {
        assignee = {type: 'schedule', assignee: schedule};
      }
    }
    onAssigneeChange?.(assignee);
  };

  const getSelectedValue = () => {
    if (!selectedAssignee) return undefined;

    const {type, assignee} = selectedAssignee;
    if (type === 'user') {
      return `user:${(assignee as User).id}`;
    }
    if (type === 'team') {
      return `team:${(assignee as Team).id}`;
    }
    if (type === 'schedule') {
      return `schedule:${(assignee as RotationSchedule).id}`;
    }
    return undefined;
  };

  const renderTriggerLabel = () => {
    if (!selectedAssignee) {
      return t('Unassigned');
    }

    const {type, assignee} = selectedAssignee;

    if (type === 'user') {
      const user = assignee as User;
      return (
        <TriggerLabel>
          <UserAvatar user={user} size={20} />
          <TriggerLabelText>{user.name || user.email}</TriggerLabelText>
        </TriggerLabel>
      );
    }
    if (type === 'team') {
      const team = assignee as Team;
      return (
        <TriggerLabel>
          <TeamAvatar team={team} size={20} />
          <TriggerLabelText>#{team.slug}</TriggerLabelText>
        </TriggerLabel>
      );
    }
    if (type === 'schedule') {
      const schedule = assignee as RotationSchedule;
      return (
        <TriggerLabel>
          <IconCalendar size="md" />
          <TriggerLabelText>{schedule.name}</TriggerLabelText>
        </TriggerLabel>
      );
    }

    return t('Unassigned');
  };

  if (isLoading) {
    return (
      <StyledButton size="sm" disabled>
        <LoadingIndicator mini />
      </StyledButton>
    );
  }

  return (
    <CompactSelect
      size="sm"
      searchable
      clearable
      options={assigneeOptions}
      value={getSelectedValue()}
      onChange={handleChange}
      onSearch={onSearch}
      triggerLabel={renderTriggerLabel()}
      triggerProps={{
        size: 'sm',
      }}
      menuTitle={t('Assign to')}
      searchPlaceholder={t('Search users, teams, or schedules...')}
    />
  );
}

const StyledButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const TriggerLabel = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const TriggerLabelText = styled('span')`
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
