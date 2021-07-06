import {useState} from 'react';
import styled from '@emotion/styled';

import Input from 'app/components/forms/input';
import {t} from 'app/locale';
import {Team} from 'app/types';

import Filter from './filter';

const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];

type Props = {
  teams: Team[];
  selectedTeams: Set<string>;
  handleChangeFilter: (sectionId: string, activeFilters: Set<string>) => void;
  showStatus?: boolean;
  selectedStatus?: Set<string>;
};

export function getTeamParams(team?: string | string[]): string[] {
  if (team === undefined) {
    return ALERT_LIST_QUERY_DEFAULT_TEAMS;
  }

  if (team === '') {
    return [];
  }

  if (Array.isArray(team)) {
    return team;
  }

  return [team];
}

function TeamFilter({
  teams,
  selectedTeams,
  showStatus = false,
  selectedStatus = new Set(),
  handleChangeFilter,
}: Props) {
  const [teamFilterSearch, setTeamFilterSearch] = useState<string | undefined>();

  const statusOptions = [
    {
      label: t('Unresolved'),
      value: 'open',
      checked: selectedStatus.has('open'),
      filtered: false,
    },
    {
      label: t('Resolved'),
      value: 'closed',
      checked: selectedStatus.has('closed'),
      filtered: false,
    },
  ];

  const additionalOptions = [
    {
      label: t('My Teams'),
      value: 'myteams',
      checked: selectedTeams.has('myteams'),
      filtered: false,
    },
    {
      label: t('Unassigned'),
      value: 'unassigned',
      checked: selectedTeams.has('unassigned'),
      filtered: false,
    },
  ];
  const teamItems = teams.map(({id, name}) => ({
    label: name,
    value: id,
    filtered: teamFilterSearch
      ? !name.toLowerCase().includes(teamFilterSearch.toLowerCase())
      : false,
    checked: selectedTeams.has(id),
  }));

  return (
    <Filter
      header={
        <StyledInput
          autoFocus
          placeholder={t('Filter by team name')}
          onClick={event => {
            event.stopPropagation();
          }}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setTeamFilterSearch(event.target.value);
          }}
          value={teamFilterSearch || ''}
        />
      }
      onFilterChange={handleChangeFilter}
      dropdownSections={[
        ...(showStatus
          ? [
              {
                id: 'status',
                label: t('Status'),
                items: statusOptions,
              },
            ]
          : []),
        {
          id: 'teams',
          label: t('Teams'),
          items: [...additionalOptions, ...teamItems],
        },
      ]}
    />
  );
}

export default TeamFilter;

const StyledInput = styled(Input)`
  border: none;
  border-bottom: 1px solid ${p => p.theme.gray200};
  border-radius: 0;
`;
