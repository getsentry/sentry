import {useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Input from 'sentry/components/forms/controls/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useTeams from 'sentry/utils/useTeams';

import Filter from './filter';

type Props = {
  handleChangeFilter: (sectionId: string, activeFilters: Set<string>) => void;
  selectedTeams: Set<string>;
  fullWidth?: boolean;
  selectedStatus?: Set<string>;
  /**
   * only show teams user is a member of
   */
  showIsMemberTeams?: boolean;
  /**
   * show My Teams and Unassigned options
   */
  showMyTeamsAndUnassigned?: boolean;
  /**
   * show My Teams as the default dropdown description
   */
  showMyTeamsDescription?: boolean;
  showStatus?: boolean;
};

function TeamFilter({
  selectedTeams,
  showStatus = false,
  selectedStatus = new Set(),
  handleChangeFilter,
  fullWidth = false,
  showIsMemberTeams = false,
  showMyTeamsAndUnassigned = true,
  showMyTeamsDescription = false,
}: Props) {
  const {teams, onSearch, fetching} = useTeams();
  const debouncedSearch = debounce(onSearch, DEFAULT_DEBOUNCE_DURATION);
  const [teamFilterSearch, setTeamFilterSearch] = useState<string | undefined>();
  const isSuperuser = isActiveSuperuser();

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
  const isMemberTeams = teams.filter(team => team.isMember);
  const teamItems = (isSuperuser ? teams : showIsMemberTeams ? isMemberTeams : teams).map(
    ({id, slug}) => ({
      label: slug,
      value: id,
      filtered: teamFilterSearch
        ? !slug.toLowerCase().includes(teamFilterSearch.toLowerCase())
        : false,
      checked: selectedTeams.has(id),
    })
  );

  return (
    <Filter
      fullWidth={fullWidth}
      showMyTeamsDescription={showMyTeamsDescription}
      header={
        <InputWrapper>
          <StyledInput
            autoFocus
            placeholder={t('Filter teams')}
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
          items: showMyTeamsAndUnassigned
            ? [...additionalOptions, ...teamItems]
            : [...teamItems],
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
  border-radius: 0;
  border-bottom: solid 1px ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: 0;
  top: ${space(0.75)};
`;
