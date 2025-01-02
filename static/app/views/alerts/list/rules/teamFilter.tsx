import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import Badge from 'sentry/components/badge/badge';
import {CompactSelect} from 'sentry/components/compactSelect';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {useTeams} from 'sentry/utils/useTeams';

interface Props {
  handleChangeFilter: (activeFilters: string[]) => void;
  selectedTeams: string[];
  /**
   * hide other teams suggestion
   */
  hideOtherTeams?: boolean;
  /**
   * hide unassigned suggestion
   */
  hideUnassigned?: boolean;
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

const makeTeamOption = (team: Team) => ({
  value: team.id,
  label: `#${team.slug}`,
  leadingItems: <TeamAvatar team={team} size={18} />,
});

function TeamFilter({
  selectedTeams,
  handleChangeFilter,
  hideUnassigned = false,
  hideOtherTeams = false,
}: Props) {
  const {teams, onSearch, fetching} = useTeams();

  const [myTeams, otherTeams] = partition(teams, team => team.isMember);
  const myTeamOptions = myTeams.map(makeTeamOption);
  const otherTeamOptions = otherTeams.map(makeTeamOption);

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

    return [<IconUser key={0} />, t('All Teams')];
  }, [selectedTeams, teams]);

  return (
    <CompactSelect
      multiple
      clearable
      searchable
      loading={fetching}
      menuTitle={t('Filter teams')}
      options={[
        {
          value: '_suggested',
          label: t('Suggested'),
          options: suggestedOptions.filter(
            opt => !hideUnassigned || opt.value !== 'unassigned'
          ),
        },
        {value: '_my_teams', label: t('My Teams'), options: myTeamOptions},
        ...(hideOtherTeams
          ? []
          : [{value: '_teams', label: t('Other Teams'), options: otherTeamOptions}]),
      ]}
      value={selectedTeams}
      onSearch={debounce(val => void onSearch(val), DEFAULT_DEBOUNCE_DURATION)}
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
