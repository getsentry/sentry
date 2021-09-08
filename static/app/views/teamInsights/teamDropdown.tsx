import {useState} from 'react';
import styled from '@emotion/styled';

import Input from 'app/components/forms/input';
import {t} from 'app/locale';
import {Team} from 'app/types';

import Filter from './filter';

const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];

type Props = {
  teams: Team[];
  selectedTeam: string;
  handleChangeTeam: (teamId: string) => void;
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

function TeamDropdown({teams, selectedTeam, handleChangeTeam}: Props) {
  const [teamFilterSearch, setTeamFilterSearch] = useState<string | undefined>();

  const teamItems = teams.map(({id, name}) => ({
    label: name,
    value: id,
    filtered: teamFilterSearch
      ? !name.toLowerCase().includes(teamFilterSearch.toLowerCase())
      : false,
    checked: selectedTeam === id,
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
      onFilterChange={handleChangeTeam}
      dropdownSection={{
        id: 'teams',
        label: t('Teams'),
        items: teamItems,
      }}
    />
  );
}

export default TeamDropdown;

const StyledInput = styled(Input)`
  border: none;
  border-bottom: 1px solid ${p => p.theme.gray200};
  border-radius: 0;
`;
