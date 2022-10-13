import {useRef} from 'react';
import {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addTeamToProject} from 'sentry/actionCreators/projects';
import Button from 'sentry/components/button';
import SelectControl, {
  ControlProps,
  GeneralSelectValue,
  StylesConfig,
} from 'sentry/components/forms/controls/selectControl';
import IdBadge from 'sentry/components/idBadge';
import Tooltip from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, Team} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useApi from 'sentry/utils/useApi';
import useTeams from 'sentry/utils/useTeams';
import withOrganization from 'sentry/utils/withOrganization';

const UnassignedWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIconUser = styled(IconUser)`
  margin-left: ${space(0.25)};
  margin-right: ${space(1)};
  color: ${p => p.theme.gray400};
`;

// An option to be unassigned on the team dropdown
const unassignedOption = {
  value: null,
  label: (
    <UnassignedWrapper>
      <StyledIconUser size="20px" />
      {t('Unassigned')}
    </UnassignedWrapper>
  ),
  searchKey: 'unassigned',
  actor: null,
  disabled: false,
};

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

type Props = {
  onChange: (value: any) => any;
  organization: Organization;
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
} & ControlProps;

type TeamActor = {
  id: string;
  name: string;
  type: 'team';
};

type TeamOption = GeneralSelectValue & {
  actor: TeamActor | null;
  searchKey: string;
};

function TeamSelector(props: Props) {
  const {includeUnassigned, styles, ...extraProps} = props;
  const {teamFilter, organization, project, multiple, value, useId, onChange} = props;

  const api = useApi();
  const {teams, fetching, onSearch} = useTeams();

  // TODO(ts) This type could be improved when react-select types are better.
  const selectRef = useRef<any>(null);

  const createTeamOption = (team: Team): TeamOption => ({
    value: useId ? team.id : team.slug,
    label: `#${team.slug}`,
    leadingItems: <IdBadge team={team} hideName />,
    searchKey: team.slug,
    actor: {
      type: 'team',
      id: team.id,
      name: team.slug,
    },
  });

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

  async function handleAddTeamToProject(team: Team) {
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
  }

  function createTeamOutsideProjectOption(team: Team): TeamOption {
    // If the option/team is currently selected, optimistically assume it is now a part of the project
    if (value === (useId ? team.id : team.slug)) {
      return createTeamOption(team);
    }
    const canAddTeam = organization.access.includes('project:write');

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
        >
          <AddToProjectButton
            type="button"
            size="zero"
            borderless
            disabled={!canAddTeam}
            onClick={() => handleAddTeamToProject(team)}
            icon={<IconAdd isCircled />}
            aria-label={t('Add %s to project', `#${team.slug}`)}
          />
        </Tooltip>
      ),
      tooltip: t('%s is not a member of project', `#${team.slug}`),
    };
  }

  function getOptions() {
    const isSuperuser = isActiveSuperuser();
    const filteredTeams = isSuperuser
      ? teams
      : teamFilter
      ? teams.filter(teamFilter)
      : teams;

    if (project) {
      const teamsInProjectIdSet = new Set(project.teams.map(team => team.id));
      const teamsInProject = filteredTeams.filter(team =>
        teamsInProjectIdSet.has(team.id)
      );
      const teamsNotInProject = filteredTeams.filter(
        team => !teamsInProjectIdSet.has(team.id)
      );

      return [
        ...teamsInProject.map(createTeamOption),
        ...teamsNotInProject.map(createTeamOutsideProjectOption),
        ...(includeUnassigned ? [unassignedOption] : []),
      ];
    }

    return [
      ...filteredTeams.map(createTeamOption),
      ...(includeUnassigned ? [unassignedOption] : []),
    ];
  }

  return (
    <SelectControl
      ref={selectRef}
      options={getOptions()}
      onInputChange={debounce(val => void onSearch(val), DEFAULT_DEBOUNCE_DURATION)}
      getOptionValue={option => option.searchKey}
      styles={{
        ...(includeUnassigned ? unassignedSelectStyles : {}),
        ...(multiple ? {} : placeholderSelectStyles),
        ...(styles ?? {}),
      }}
      isLoading={fetching}
      {...extraProps}
    />
  );
}

const AddToProjectButton = styled(Button)`
  flex-shrink: 0;
`;

export {TeamSelector};

// TODO(davidenwang): this is broken due to incorrect types on react-select
export default withOrganization(TeamSelector) as unknown as (
  p: Omit<Props, 'organization'>
) => JSX.Element;
