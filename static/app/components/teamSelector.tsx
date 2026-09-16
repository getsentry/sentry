import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useDebouncedCallback} from '@tanstack/react-pacer';
import type {DistributedOmit} from 'type-fest';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import type {ControlProps, SelectValue, StylesConfig} from '@sentry/scraps/select';
import {Select, createFilter} from '@sentry/scraps/select';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {addTeamToProject} from 'sentry/actionCreators/projects';
import {IdBadge} from 'sentry/components/idBadge';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

const StyledIconUser = styled(IconUser)`
  margin-left: ${p => p.theme.space['2xs']};
  margin-right: ${p => p.theme.space.md};
  color: ${p => p.theme.colors.gray500};
`;

// An option to be unassigned on the team dropdown
const unassignedOption = {
  value: null,
  label: (
    <Flex align="center">
      <StyledIconUser size="md" />
      {t('Unassigned')}
    </Flex>
  ),
  searchKey: 'unassigned',
  actor: null,
  disabled: false,
};

const CREATE_TEAM_VALUE = 'CREATE_TEAM_VALUE';

const optionFilter = createFilter({
  stringify: option => `${option.label} ${option.value}`,
});

const filterOption = (candidate: Parameters<typeof optionFilter>[0], input: string) =>
  // Never filter out the create team option
  candidate.data.value === CREATE_TEAM_VALUE || optionFilter(candidate, input);

// Ensures that the svg icon is white when selected
const getUnassignedSelectStyles = (theme: Theme): StylesConfig => ({
  option: (provided, state) => ({
    ...provided,
    svg: {color: state.isSelected ? theme.colors.white : undefined},
  }),
});

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
  onChange: (value: any) => void;
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
};

type TeamActor = {
  id: string;
  name: string;
  type: 'team';
};

export interface TeamOption extends SelectValue<string | null> {
  actor: TeamActor | null;
  searchKey: string;
}

export function TeamSelector(props: Props) {
  const theme = useTheme();
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

  // The initial team list is paginated, so saved selections may not be loaded yet.
  const selectedTeamsQuery = useMemo(() => {
    const values = Array.isArray(value) ? value : [value];
    const selectedValues = values.filter(defined).map(String);
    const teamValues = selectedValues.filter(
      team => team !== '' && team !== CREATE_TEAM_VALUE
    );

    return useId ? {ids: teamValues} : {slugs: teamValues};
  }, [useId, value]);
  const {isLoading: loadingSelectedTeams} = useTeamsById(selectedTeamsQuery);

  const selectRef = useRef<{select: {inputRef: HTMLInputElement | null}}>(null);

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
    const input = select.inputRef;

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
      const oldValue = multiple ? [...((value as unknown[] | undefined) ?? [])] : {value};
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
      if (Array.isArray(newValue)) {
        const options = newValue;
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

      const option = newValue;
      if (option.value === CREATE_TEAM_VALUE) {
        createTeam().then(newTeamOption => {
          onChange(newTeamOption);
        });
      } else {
        onChange?.(option);
      }
    },
    [createTeam, onChange]
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
              variant="transparent"
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

  const options = useMemo(() => {
    const teams = filterByUserMembership
      ? initialTeams.filter(team => team.isMember)
      : initialTeams;
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
  }, [
    teamFilter,
    initialTeams,
    filterByUserMembership,
    canCreateTeam,
    project,
    allowCreate,
    createTeamOption,
    includeUnassigned,
    createTeamOutsideProjectOption,
  ]);

  const handleInputChange = useDebouncedCallback(
    (search: string) => void onSearch(search),
    {wait: DEFAULT_DEBOUNCE_DURATION}
  );

  const styles = useMemo(
    () => ({
      ...(includeUnassigned ? getUnassignedSelectStyles(theme) : {}),
      ...(multiple ? {} : getPlaceholderSelectStyles(theme)),
      ...stylesProp,
    }),
    [includeUnassigned, multiple, stylesProp, theme]
  );

  useEffect(() => {
    // Only take action after we've finished loading the teams
    if (fetching || loadingSelectedTeams) {
      return;
    }

    // If there is only one team, and our flow wants to enable using that team as a default, update the parent state
    const onlyOption = options[0];
    const hasSelection = Array.isArray(value)
      ? value.length > 0
      : defined(value) && value !== '';
    if (!hasSelection && options.length === 1 && onlyOption && useTeamDefaultIfOnlyOne) {
      handleChange(multiple ? options : onlyOption);
    }
    // We only want to do this once when the component is finished loading for teams and mounted.
    // If the user decides they do not want the default, we should not add the default value back.
  }, [fetching, loadingSelectedTeams, useTeamDefaultIfOnlyOne]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Select
      ref={selectRef}
      options={options}
      onInputChange={handleInputChange}
      filterOption={filterOption}
      styles={styles}
      isLoading={fetching || loadingSelectedTeams}
      onChange={handleChange as never}
      {...extraProps}
    />
  );
}
