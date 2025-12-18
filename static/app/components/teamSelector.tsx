import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {addTeamToProject} from 'sentry/actionCreators/projects';
import {Button} from 'sentry/components/core/button';
import type {
  ControlProps,
  GeneralSelectValue,
  StylesConfig,
} from 'sentry/components/core/select';
import {Select} from 'sentry/components/core/select';
import {Tooltip} from 'sentry/components/core/tooltip';
import {createFilter} from 'sentry/components/forms/controls/reactSelectWrapper';
import IdBadge from 'sentry/components/idBadge';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';

const UnassignedWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIconUser = styled(IconUser)`
  margin-left: ${space(0.25)};
  margin-right: ${space(1)};
  color: ${p => p.theme.colors.gray500};
`;

// An option to be unassigned on the team dropdown
const unassignedOption = {
  value: null,
  label: (
    <UnassignedWrapper>
      <StyledIconUser size="md" />
      {t('Unassigned')}
    </UnassignedWrapper>
  ),
  searchKey: 'unassigned',
  actor: null,
  disabled: false,
};

const CREATE_TEAM_VALUE = 'CREATE_TEAM_VALUE';

const optionFilter = createFilter({
  stringify: option => `${option.label} ${option.value}`,
});

const filterOption = (canditate: any, input: any) =>
  // Never filter out the create team option
  canditate.data.value === CREATE_TEAM_VALUE || optionFilter(canditate, input);

const getOptionValue = (option: TeamOption) => option.value;

// Ensures that the svg icon is white when selected
const unassignedSelectStyles: StylesConfig = {
  option: (provided, state) => {
    // XXX: The `state.theme` is an emotion theme object, but it is not typed
    // as the emotion theme object in react-select
    const theme = state.theme as unknown as Theme;

    return {...provided, svg: {color: state.isSelected ? theme.white : undefined}};
  },
};

const placeholderSelectStyles: StylesConfig = {
  input: (provided, state) => {
    // XXX: The `state.theme` is an emotion theme object, but it is not typed
    // as the emotion theme object in react-select
    const theme = state.theme as unknown as Theme;

    return {
      ...provided,
      display: 'grid',
      gridTemplateColumns: 'max-content 1fr',
      alignItems: 'center',
      gridGap: space(1),
      ':before': {
        backgroundColor: theme.backgroundSecondary,
        height: 24,
        width: 24,
        borderRadius: 3,
        content: '""',
        display: 'block',
      },
    };
  },
  placeholder: provided => ({
    ...provided,
    paddingLeft: 32,
  }),
};

interface Props extends ControlProps {
  onChange: (value: any) => any;
  /**
   * Controls whether the dropdown allows to create a new team
   */
  allowCreate?: boolean;
  /**
   * Flag that indicates whether to filter teams to only show teams that the user is a member of
   */
  filterByUserMembership?: boolean;
  includeUnassigned?: boolean;
  /**
   * Can be used to restrict teams to a certain project and allow for new teams to be add to that project
   */
  project?: Project;
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
}

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
  const organization = useOrganization();
  const {
    allowCreate,
    includeUnassigned,
    filterByUserMembership = false,
    styles: stylesProp,
    onChange,
    useTeamDefaultIfOnlyOne = false,
    ...extraProps
  } = props;
  const {teamFilter, project, multiple, value, useId} = props;

  const api = useApi();
  const {teams: initialTeams, fetching, onSearch} = useTeams();

  let teams = initialTeams;
  if (filterByUserMembership) {
    teams = initialTeams.filter(team => team.isMember);
  }

  // TODO(ts) This type could be improved when react-select types are better.
  const selectRef = useRef<any>(null);

  const canCreateTeam = organization?.access?.includes('project:admin') ?? false;
  const canAddTeam = organization?.access?.includes('project:write') ?? false;

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

  /**
   * Closes the select menu by blurring input if possible since that seems to
   * be the only way to close it.
   */
  function closeSelectMenu() {
    if (!selectRef.current) {
      return;
    }

    const select = selectRef.current.select;
    const input: HTMLInputElement = select.inputRef;

    if (input) {
      // I don't think there's another way to close `react-select`
      input.blur();
    }
  }

  const handleAddTeamToProject = useCallback(
    async (team: Team) => {
      if (!project) {
        closeSelectMenu();
        return;
      }

      // Copy old value
      const oldValue = multiple ? [...(value ?? [])] : {value};
      // Optimistic update
      onChange?.(createTeamOption(team));

      try {
        await addTeamToProject(api, organization.slug, project.slug, team);
      } catch (err) {
        // Unable to add team to project, revert select menu value
        onChange?.(oldValue);
      }

      closeSelectMenu();
    },
    [api, createTeamOption, multiple, onChange, organization, project, value]
  );

  const createTeam = useCallback(
    () =>
      new Promise<TeamOption>(resolve => {
        openCreateTeamModal({
          organization,
          onClose: async team => {
            if (project) {
              await handleAddTeamToProject(team);
            }
            resolve(createTeamOption(team));
          },
        });
      }),
    [createTeamOption, handleAddTeamToProject, organization, project]
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

  const createTeamOutsideProjectOption = useCallback(
    (team: Team): TeamOption => {
      // If the option/team is currently selected, optimistically assume it is now a part of the project
      if (value === (useId ? team.id : team.slug)) {
        return createTeamOption(team);
      }

      return {
        ...createTeamOption(team),
        disabled: true,
        label: `#${team.slug}`,
        leadingItems: <IdBadge team={team} hideName />,
        trailingItems: (
          <Tooltip
            title={
              canAddTeam
                ? t('Add %s to project', `#${team.slug}`)
                : t('You do not have permission to add team to project.')
            }
            containerDisplayMode="flex"
            skipWrapper
          >
            <Button
              size="zero"
              borderless
              disabled={!canAddTeam}
              onClick={() => handleAddTeamToProject(team)}
              icon={<IconAdd />}
              aria-label={t('Add %s to project', `#${team.slug}`)}
            />
          </Tooltip>
        ),
        tooltip: t('%s is not a member of project', `#${team.slug}`),
      };
    },
    [canAddTeam, createTeamOption, handleAddTeamToProject, useId, value]
  );

  function getOptions() {
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

    if (project) {
      const teamsInProjectIdSet = new Set(project.teams.map(team => team.id));
      const teamsInProject = filteredTeams.filter(team =>
        teamsInProjectIdSet.has(team.id)
      );
      const teamsNotInProject = filteredTeams.filter(
        team => !teamsInProjectIdSet.has(team.id)
      );

      return [
        ...(allowCreate ? [createOption] : []),
        ...teamsInProject.map(createTeamOption),
        ...teamsNotInProject.map(createTeamOutsideProjectOption),
        ...(includeUnassigned ? [unassignedOption] : []),
      ];
    }

    return [
      ...(allowCreate ? [createOption] : []),
      ...filteredTeams.map(createTeamOption),
      ...(includeUnassigned ? [unassignedOption] : []),
    ];
  }

  const options = useMemo(getOptions, [
    teamFilter,
    teams,
    canCreateTeam,
    project,
    allowCreate,
    createTeamOption,
    includeUnassigned,
    createTeamOutsideProjectOption,
  ]);

  const handleInputChange = useMemo(
    () => debounce(val => void onSearch(val), DEFAULT_DEBOUNCE_DURATION),
    [onSearch]
  );

  const styles = useMemo(
    () => ({
      ...(includeUnassigned ? unassignedSelectStyles : {}),
      ...(multiple ? {} : placeholderSelectStyles),
      ...stylesProp,
    }),
    [includeUnassigned, multiple, stylesProp]
  );

  useEffect(() => {
    // Only take action after we've finished loading the teams
    if (fetching) {
      return;
    }

    // If there is only one team, and our flow wants to enable using that team as a default, update the parent state
    if (options.length === 1 && useTeamDefaultIfOnlyOne) {
      const castedValue = multiple
        ? (options as TeamOption[])
        : (options[0] as TeamOption);
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
      getOptionValue={getOptionValue}
      filterOption={filterOption}
      styles={styles}
      isLoading={fetching}
      onChange={handleChange}
      {...extraProps}
    />
  );
}
