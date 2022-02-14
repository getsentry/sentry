import {useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Input from 'sentry/components/deprecatedforms/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useTeams from 'sentry/utils/useTeams';

import Filter from './filter';

const ALERT_LIST_QUERY_DEFAULT_TEAMS = ['myteams', 'unassigned'];

type Props = {
  handleChangeFilter: (sectionId: string, activeFilters: Set<string>) => void;
  selectedTeams: Set<string>;
  selectedStatus?: Set<string>;
  showStatus?: boolean;
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
  selectedTeams,
  showStatus = false,
  selectedStatus = new Set(),
  handleChangeFilter,
}: Props) {
  const {teams, onSearch, fetching} = useTeams();
  const debouncedSearch = debounce(onSearch, DEFAULT_DEBOUNCE_DURATION);
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
  const teamItems = teams.map(({id, slug}) => ({
    label: slug,
    value: id,
    filtered: teamFilterSearch
      ? !slug.toLowerCase().includes(teamFilterSearch.toLowerCase())
      : false,
    checked: selectedTeams.has(id),
  }));

  return (
    <Filter
      header={
        <InputWrapper>
          <StyledInput
            autoFocus
            placeholder={t('Filter by team slug')}
            onClick={event => {
              event.stopPropagation();
            }}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const search = event.target.value;
              setTeamFilterSearch(search);
              debouncedSearch(search);
            }}
            value={teamFilterSearch || ''}
          />
          {fetching && <StyledLoadingIndicator size={16} mini />}
        </InputWrapper>
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

const InputWrapper = styled('div')`
  position: relative;
`;

const StyledInput = styled(Input)`
  border: none;
  border-bottom: 1px solid transparent;
  border-radius: 0;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: 0;
  top: ${space(0.75)};
`;
