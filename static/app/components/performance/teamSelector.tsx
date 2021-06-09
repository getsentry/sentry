import {useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Input from 'app/components/forms/input';
import {t} from 'app/locale';
import {Team} from 'app/types';
import {defined} from 'app/utils';
import Filter from 'app/views/alerts/rules/filter';

type Props = {
  teams: Team[];
  selectedTeams: Set<string>;
  handleChangeFilter: (activeFilters: Set<string>) => void;
};

export function getSelectedTeamIdsFromLocation(location: Location): string[] {
  const team = location.query.team;

  if (!defined(team)) {
    return ['myteams'];
  }

  if (Array.isArray(team)) {
    return team;
  }

  return [team];
}

export function getSelectedTeams(teams: Team[], selectedTeamIds: Set<string>) {
  const userTeams = teams.filter(({isMember}) => isMember);

  if (selectedTeamIds.has('myteams')) {
    return userTeams;
  }

  return userTeams.filter(({id}) => selectedTeamIds.has(id));
}

export default function TeamSelector({teams, selectedTeams, handleChangeFilter}: Props) {
  const [teamFilterSearch, setTeamFilterSearch] = useState<string | undefined>();

  const teamItems = teams.map(({id, name}) => ({
    label: name,
    value: id,
    filtered: teamFilterSearch
      ? name.toLowerCase().includes(teamFilterSearch.toLowerCase())
      : true,
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
      onFilterChange={(_sectionId, activeFilters) => handleChangeFilter(activeFilters)}
      dropdownSections={[
        {
          id: 'my teams',
          label: t('My Teams'),
          items: teamItems,
        },
      ]}
    />
  );
}

const StyledInput = styled(Input)`
  border: none;
  border-bottom: 1px solid ${p => p.theme.gray200};
  border-radius: 0;
`;
