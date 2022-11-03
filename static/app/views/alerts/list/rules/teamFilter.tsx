import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import Badge from 'sentry/components/badge';
import CompactSelect from 'sentry/components/compactSelect';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import useTeams from 'sentry/utils/useTeams';

interface Props {
  handleChangeFilter: (activeFilters: string[]) => void;
  selectedTeams: string[];
  /**
   * only show teams user is a member of
   */
  showIsMemberTeams?: boolean;
  /**
   * show My Teams as the default dropdown description
   */
  showMyTeamsDescription?: boolean;
  /**
   * show suggested options (My Teams and Unassigned)
   */
  showSuggestedOptions?: boolean;
}

const suggestedOptions = [
  {
    label: t('My Teams'),
    value: 'myteams',
  },
  {
    label: t('Unassigned'),
    value: 'unassigned',
  },
];

function TeamFilter({
  selectedTeams,
  handleChangeFilter,
  showIsMemberTeams = false,
  showSuggestedOptions = true,
  showMyTeamsDescription = false,
}: Props) {
  const {teams, onSearch, fetching} = useTeams({provideUserTeams: showIsMemberTeams});

  const teamOptions = useMemo(
    () =>
      teams.map(team => ({
        value: team.id,
        label: `#${team.slug}`,
        leadingItems: <TeamAvatar team={team} size={18} />,
      })),
    [teams]
  );

  const [triggerIcon, triggerLabel] = useMemo(() => {
    const firstSelectedSuggestion =
      selectedTeams[0] && suggestedOptions.find(opt => opt.value === selectedTeams[0]);

    const firstSelectedTeam =
      selectedTeams[0] && teams.find(team => team.id === selectedTeams[0]);

    if (firstSelectedSuggestion) {
      return [<IconUser key={0} />, firstSelectedSuggestion.label];
    }

    if (firstSelectedTeam) {
      return [
        <TeamAvatar team={firstSelectedTeam} size={16} key={0} />,
        `#${firstSelectedTeam.slug}`,
      ];
    }

    return [
      <IconUser key={0} />,
      showMyTeamsDescription ? t('My Teams') : t('All Teams'),
    ];
  }, [selectedTeams, teams, showMyTeamsDescription]);

  return (
    <CompactSelect
      multiple
      isClearable
      isSearchable
      isLoading={fetching}
      menuTitle={t('Filter teams')}
      options={
        showSuggestedOptions
          ? [
              {value: '_suggested', label: t('Suggested'), options: suggestedOptions},
              {value: '_teams', label: t('Teams'), options: teamOptions},
            ]
          : teamOptions
      }
      value={selectedTeams}
      onInputChange={debounce(val => void onSearch(val), DEFAULT_DEBOUNCE_DURATION)}
      onChange={opts => {
        // Compact select type inference does not work - onChange type is actually T | null.
        if (!opts) {
          return handleChangeFilter([]);
        }
        return handleChangeFilter(opts.map(opt => opt.value));
      }}
      triggerLabel={
        <Fragment>
          {triggerLabel}
          {selectedTeams.length > 1 && (
            <StyledBadge text={`+${selectedTeams.length - 1}`} />
          )}
        </Fragment>
      }
      triggerProps={{icon: triggerIcon}}
    />
  );
}

export default TeamFilter;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;
