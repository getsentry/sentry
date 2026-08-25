import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import debounce from 'lodash/debounce';
import type {DistributedOmit} from 'type-fest';

import type {ControlProps, GeneralSelectValue, StylesConfig} from '@sentry/scraps/select';
import {Select} from '@sentry/scraps/select';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {createFilter} from 'sentry/components/forms/controls/reactSelectWrapper';
import {IdBadge} from 'sentry/components/idBadge';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';

const CREATE_TEAM_VALUE = 'CREATE_TEAM_VALUE';

const optionFilter = createFilter({
  stringify: option => `${option.label} ${option.value}`,
});

const filterOption = (canditate: any, input: any) =>
  // Never filter out the create team option
  canditate.data.value === CREATE_TEAM_VALUE || optionFilter(canditate, input);

const getPlaceholderSelectStyles = (theme: Theme): StylesConfig => ({
  input: provided => ({
    ...provided,
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    alignItems: 'center',
    gridGap: theme.space.md,
    ':before': {
      backgroundColor: theme.tokens.background.secondary,
      height: 24,
      width: 24,
      borderRadius: 3,
      content: '""',
      display: 'block',
    },
  }),
  placeholder: provided => ({
    ...provided,
    paddingLeft: 32,
  }),
});

type Props = DistributedOmit<ControlProps, 'onChange'> & {
  onChange: (value: any) => any;
  /**
   * Controls whether the dropdown allows to create a new team
   */
  allowCreate?: boolean;
  /**
   * Flag that indicates whether to filter teams to only show teams that the user is a member of
   */
  filterByUserMembership?: boolean;
  /**
   * Function to control whether a team should be shown in the dropdown
   */
  teamFilter?: (team: Team) => boolean;
  /**
   * Controls whether the value in the dropdown is a team id or team slug
   */
  useId?: boolean;
  /**
   * Flag that lets the caller decide to use the team value by default if there is only one option
   */
  useTeamDefaultIfOnlyOne?: boolean;
};

type TeamActor = {
  id: string;
  name: string;
  type: 'team';
};

export interface TeamOption extends GeneralSelectValue {
  actor: TeamActor | null;
  searchKey: string;
}

export function TeamSelector(props: Props) {
  const theme = useTheme();
  const organization = useOrganization();
  const {
    allowCreate,
    filterByUserMembership = false,
    styles: stylesProp,
    onChange,
    useTeamDefaultIfOnlyOne = false,
    ...extraProps
  } = props;
  const {teamFilter, multiple, useId} = props;

  const {teams: initialTeams, fetching, onSearch} = useTeams();

  let teams = initialTeams;
  if (filterByUserMembership) {
    teams = initialTeams.filter(team => team.isMember);
  }

  // TODO(ts) This type could be improved when react-select types are better.
  const selectRef = useRef<any>(null);

  const canCreateTeam = organization?.access?.includes('project:admin') ?? false;

  const createTeamOption = useCallback(
    (team: Team): TeamOption => ({
      value: useId ? team.id : team.slug,
      label: `#${team.slug}`,
      leadingItems: <IdBadge team={team} hideName />,
      searchKey: team.slug,
      actor: {
        type: 'team',
        id: team.id,
        name: team.slug,
      },
    }),
    [useId]
  );

  const createTeam = useCallback(
    () =>
      new Promise<TeamOption>(resolve => {
        openCreateTeamModal({
          organization,
          onClose: team => {
            resolve(createTeamOption(team));
          },
        });
      }),
    [createTeamOption, organization]
  );

  const handleChange = useCallback(
    (newValue: TeamOption | TeamOption[]) => {
      if (multiple) {
        const options = newValue as TeamOption[];
        const shouldCreate = options.find(option => option.value === CREATE_TEAM_VALUE);
        if (shouldCreate) {
          createTeam().then(newTeamOption => {
            onChange?.([
              ...options.filter(option => option.value !== CREATE_TEAM_VALUE),
              newTeamOption,
            ]);
          });
        } else {
          onChange?.(options);
        }
        return;
      }

      const option = newValue as TeamOption;
      if (option.value === CREATE_TEAM_VALUE) {
        createTeam().then(newTramOption => {
          onChange?.(newTramOption);
        });
      } else {
        onChange?.(option);
      }
    },
    [createTeam, multiple, onChange]
  );

  const options = useMemo(() => {
    const filteredTeams = teamFilter ? teams.filter(teamFilter) : teams;

    const createOption = {
      value: CREATE_TEAM_VALUE,
      label: t('Create team'),
      leadingItems: <IconAdd />,
      searchKey: 'create',
      actor: null,
      disabled: !canCreateTeam,
      'data-test-id': 'create-team-option',
    };

    return [
      ...(allowCreate ? [createOption] : []),
      ...filteredTeams.map(createTeamOption),
    ];
  }, [teamFilter, teams, canCreateTeam, allowCreate, createTeamOption]);

  const handleInputChange = useMemo(
    () => debounce(val => void onSearch(val), DEFAULT_DEBOUNCE_DURATION),
    [onSearch]
  );

  const styles = useMemo(
    () => ({
      ...(multiple ? {} : getPlaceholderSelectStyles(theme)),
      ...stylesProp,
    }),
    [multiple, stylesProp, theme]
  );

  useEffect(() => {
    // Only take action after we've finished loading the teams
    if (fetching) {
      return;
    }

    // If there is only one team, and our flow wants to enable using that team as a default, update the parent state
    if (options.length === 1 && useTeamDefaultIfOnlyOne) {
      const castedValue = multiple ? options : (options[0] as TeamOption);
      handleChange(castedValue);
    }
    // We only want to do this once when the component is finished loading for teams and mounted.
    // If the user decides they do not want the default, we should not add the default value back.
  }, [fetching, useTeamDefaultIfOnlyOne]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Select
      ref={selectRef}
      options={options}
      onInputChange={handleInputChange}
      getOptionValue={option => option.value}
      filterOption={filterOption}
      styles={styles}
      isLoading={fetching}
      onChange={handleChange as never}
      {...extraProps}
    />
  );
}
