import {useState} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import Input from 'app/components/forms/input';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Team} from 'app/types';

import Filter from './filter';

const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];

type Props = {
  teams: Team[];
  selectedTeams: Set<string>;
  handleChangeFilter: (activeFilters: Set<string>) => void;
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

function TeamFilter({teams, selectedTeams, handleChangeFilter}: Props) {
  const [teamFilterSearch, setTeamFilterSearch] = useState<string | undefined>();
  const additionalOptions = [
    {label: t('My Teams'), value: 'myteams'},
    {label: t('Unassigned'), value: 'unassigned'},
  ];
  const statusOptions = [
    {label: t('Unresolved'), value: 'open'},
    {label: t('Resolved'), value: 'closed'},
  ];
  const optionValues = [
    ...teams.map(({id}) => `team-${id}`),
    ...additionalOptions.map(({value}) => `team-${value}`),
    ...statusOptions.map(({value}) => value),
  ];
  const filteredTeams = teams.filter(({name}) =>
    teamFilterSearch ? name.toLowerCase().includes(teamFilterSearch.toLowerCase()) : true
  );

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
      filterList={optionValues}
      selection={selectedTeams}
    >
      {({toggleFilter}) => [
        {
          id: 'status',
          label: t('Status'),
          items: (
            <List>
              {statusOptions.map(({label, value}) => (
                <ListItem
                  key={value}
                  isChecked={selectedTeams.has(value)}
                  onClick={event => {
                    event.stopPropagation();
                    toggleFilter(value);
                  }}
                >
                  <TeamName>{label}</TeamName>
                  <CheckboxFancy isChecked={selectedTeams.has(value)} />
                </ListItem>
              ))}
            </List>
          ),
        },
        {
          id: 'team',
          label: t('Team'),
          items: (
            <List>
              {additionalOptions.map(({label, value}) => (
                <ListItem
                  key={value}
                  isChecked={selectedTeams.has(value)}
                  onClick={event => {
                    event.stopPropagation();
                    toggleFilter(value);
                  }}
                >
                  <TeamName>{label}</TeamName>
                  <CheckboxFancy isChecked={selectedTeams.has(value)} />
                </ListItem>
              ))}
              {filteredTeams.map(({id, name}) => (
                <ListItem
                  key={id}
                  isChecked={selectedTeams.has(id)}
                  onClick={event => {
                    event.stopPropagation();
                    toggleFilter(id);
                  }}
                >
                  <TeamName>#{name}</TeamName>
                  <CheckboxFancy isChecked={selectedTeams.has(id)} />
                </ListItem>
              ))}
            </List>
          ),
        },
      ]}
    </Filter>
  );
}

export default TeamFilter;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledInput = styled(Input)`
  border: none;
  border-bottom: 1px solid ${p => p.theme.gray200};
  border-radius: 0;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }

  &:hover span {
    color: ${p => p.theme.blue300};
    text-decoration: underline;
  }
`;

const TeamName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${overflowEllipsis};
`;
