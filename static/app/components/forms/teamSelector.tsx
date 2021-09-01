import * as React from 'react';
import styled from '@emotion/styled';

import {addTeamToProject} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import Button from 'app/components/button';
import SelectControl, {ControlProps} from 'app/components/forms/selectControl';
import {IconAdd, IconUser} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, Team} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';

import IdBadge from '../idBadge';
import Tooltip from '../tooltip';

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
const unassignedSelectStyles = {
  option: (provided, state: any) => ({
    ...provided,
    svg: {
      color: state.isSelected && state.theme.white,
    },
  }),
};

type Props = {
  api: Client;
  organization: Organization;
  teams: Team[];
  onChange: (value: any) => any;
  /**
   * Function to control whether a team should be shown in the dropdown
   */
  teamFilter?: (team: Team) => boolean;
  /**
   * Can be used to restrict teams to a certain project and allow for new teams to be add to that project
   */
  project?: Project;
  /**
   * Controls whether the value in the dropdown is a team id or team slug
   */
  useId?: boolean;
  includeUnassigned?: boolean;
} & ControlProps;

type TeamActor = {
  type: 'team';
  id: string;
  name: string;
};

type TeamOption = {
  value: string | null;
  label: React.ReactElement;
  searchKey: string;
  actor: TeamActor | null;
  disabled?: boolean;
};

type State = {
  options: TeamOption[];
};

class TeamSelector extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      options: this.teamOptions,
    };
  }

  // TODO(ts) This type could be improved when react-select types are better.
  selectRef = React.createRef<any>();

  get teamOptions() {
    const {teams, teamFilter, includeUnassigned, project} = this.props;
    const filteredTeams = teamFilter ? teams.filter(teamFilter) : teams;
    if (project) {
      const teamsInProjectIdSet = new Set(project.teams.map(team => team.id));
      const teamsInProject = filteredTeams.filter(team =>
        teamsInProjectIdSet.has(team.id)
      );
      const teamsNotInProject = filteredTeams.filter(
        team => !teamsInProjectIdSet.has(team.id)
      );

      return [
        ...teamsInProject.map(this.createTeamOption),
        ...teamsNotInProject.map(this.createTeamOutsideProjectOption),
        ...(includeUnassigned ? [unassignedOption] : []),
      ];
    }
    return [
      ...filteredTeams.map(this.createTeamOption),
      ...(includeUnassigned ? [unassignedOption] : []),
    ];
  }

  createTeamOption = (team: Team): TeamOption => ({
    value: this.props.useId ? team.id : team.slug,
    label: <IdBadge team={team} />,
    searchKey: `#${team.slug}`,
    actor: {
      type: 'team',
      id: team.id,
      name: team.slug,
    },
  });

  /**
   * Closes the select menu by blurring input if possible since that seems to be the only
   * way to close it.
   */
  closeSelectMenu() {
    if (!this.selectRef.current) {
      return;
    }

    const select = this.selectRef.current.select;
    const input: HTMLInputElement = select.inputRef;
    if (input) {
      // I don't think there's another way to close `react-select`
      input.blur();
    }
  }

  handleAddTeamToProject = async (team: Team) => {
    const {api, organization, project, value} = this.props;
    const {options} = this.state;

    if (!project) {
      this.closeSelectMenu();
      return;
    }

    // Copy old value
    const oldValue = value ? [...value] : {value};

    // Optimistic update
    this.props.onChange?.(this.createTeamOption(team));

    try {
      await addTeamToProject(api, organization.slug, project.slug, team);

      // Remove add to project button without changing order
      const newOptions = options.map(option => {
        if (option.actor?.id === team.id) {
          option.disabled = false;
          option.label = <IdBadge team={team} />;
        }

        return option;
      });
      this.setState({options: newOptions});
    } catch (err) {
      // Unable to add team to project, revert select menu value
      this.props.onChange?.(oldValue);
    }
    this.closeSelectMenu();
  };

  createTeamOutsideProjectOption = (team: Team): TeamOption => {
    const {organization} = this.props;
    const canAddTeam = organization.access.includes('project:write');

    return {
      ...this.createTeamOption(team),
      disabled: true,
      label: (
        <TeamOutsideProject>
          <DisabledLabel>
            <Tooltip
              position="left"
              title={t('%s is not a member of project', `#${team.slug}`)}
            >
              <IdBadge team={team} />
            </Tooltip>
          </DisabledLabel>
          <Tooltip
            title={
              canAddTeam
                ? t('Add %s to project', `#${team.slug}`)
                : t('You do not have permission to add team to project.')
            }
          >
            <AddToProjectButton
              type="button"
              size="zero"
              borderless
              disabled={!canAddTeam}
              onClick={() => this.handleAddTeamToProject(team)}
              icon={<IconAdd isCircled />}
            />
          </Tooltip>
        </TeamOutsideProject>
      ),
    };
  };

  render() {
    const {includeUnassigned, styles, ...props} = this.props;
    const {options} = this.state;
    return (
      <SelectControl
        ref={this.selectRef}
        options={options}
        isOptionDisabled={option => option.disabled}
        styles={{
          styles,
          ...(includeUnassigned ? unassignedSelectStyles : {}),
        }}
        {...props}
      />
    );
  }
}

const TeamOutsideProject = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden; /* Needed so that "Add to team" button can fit */
`;

const AddToProjectButton = styled(Button)`
  flex-shrink: 0;
`;

export {TeamSelector};

export default withApi(withTeams(withOrganization(TeamSelector)));
