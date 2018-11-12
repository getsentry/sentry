import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {getProjectSelectorType} from 'app/components/projectSelector/utils';
import HeaderItem from 'app/components/organizations/headerItem';
import InlineSvg from 'app/components/inlineSvg';
import MultipleProjectSelectorTitle from 'app/components/organizations/multipleProjectSelector/multipleProjectSelectorTitle';
import ProjectSelector from 'app/components/projectSelector';
import SentryTypes from 'app/sentryTypes';

const rootContainerStyles = css`
  display: flex;
`;

class MultipleProjectSelector extends React.PureComponent {
  static propTypes = {
    // Show teams in selector?
    showTeams: PropTypes.bool,

    // List of detailed teams
    teams: PropTypes.arrayOf(SentryTypes.Team),

    // team loading status
    teamLoading: PropTypes.bool,

    // The teams/projects currently selected
    value: PropTypes.shape({
      projects: PropTypes.arrayOf(SentryTypes.Project),
      teams: PropTypes.arrayOf(SentryTypes.Team),
    }),

    // List of projects
    projects: PropTypes.arrayOf(SentryTypes.Project),

    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
  };

  constructor() {
    super();
    this.state = {
      hasChanges: false,
    };
  }

  // Reset "hasChanges" state and call `onUpdate` callback
  doUpdate = () => {
    this.setState({hasChanges: false}, this.props.onUpdate);
  };

  /**
   * Handler for when an explicit update call should be made.
   * e.g. an "Update" button
   *
   * Should perform an "update" callback
   */
  handleUpdate = actions => {
    actions.close();
    this.doUpdate();
  };

  /**
   * Handler for when a dropdown item was selected directly (and not via multi select)
   *
   * Should perform an "update" callback
   */
  handleQuickSelect = (selected, checked, e) => {
    const type = getProjectSelectorType(selected);
    this.props.onChange({
      [type]: [parseInt(selected.id, 10)],
    });
    this.doUpdate();
  };

  /**
   * Handler for when dropdown menu closes
   *
   * Should perform an "update" callback
   */
  handleClose = props => {
    // Only update if there are changes
    if (!this.state.hasChanges) return;
    this.doUpdate();
  };

  /**
   * Handler for clearing the current value
   *
   * Should perform an "update" callback
   */
  handleClear = () => {
    this.props.onChange({
      team: [],
      project: [],
      allProjects: [],
    });

    // Update on clear
    this.doUpdate();
  };

  /**
   * Handler for selecting multiple items, should NOT call update
   */
  handleMultiSelect = (type, selected, checked, e) => {
    const {onChange} = this.props;
    const changed = selected.map(({id}) => parseInt(id, 10));
    let allProjects;

    // If changing teams, then get a list of all projects
    if (type === 'team') {
      const teamProjects = selected
        .map(({projects}) => projects.map(({id}) => parseInt(id, 10)))
        .reduce((acc, projects) => [...acc, ...projects], []);
      allProjects = new Set(teamProjects);
    } else {
      allProjects = new Set(changed);
    }

    onChange({
      [type]: changed,
      allProjects: Array.from(allProjects),
    });

    this.setState({hasChanges: true});
  };

  render() {
    const {value, projects, teams, teamLoading, showTeams, ...props} = this.props;
    const {project, team} = value;
    const selectedProjectIds = new Set(project);
    const selectedTeamIds = new Set(team);

    const allSelectedProjects = projects.filter(({id}) =>
      selectedProjectIds.has(parseInt(id, 10))
    );
    const allSelectedTeams =
      (teams && teams.filter(({id}) => selectedTeamIds.has(parseInt(id, 10)))) || [];

    return (
      <StyledProjectSelector
        {...props}
        showTeams={showTeams}
        multi
        teams={teams}
        teamLoading={teamLoading}
        projects={projects}
        selectedTeams={allSelectedTeams}
        selectedProjects={allSelectedProjects}
        onSelect={this.handleQuickSelect}
        onClose={this.handleClose}
        onMultiSelect={this.handleMultiSelect}
        rootClassName={rootContainerStyles}
      >
        {({
          getActorProps,
          selectedItem,
          activeProject,
          selectedProjects,
          selectedTeams,
          isOpen,
          actions,
          onBlur,
        }) => {
          const hasSelected = !!selectedProjects.length || !!selectedTeams.length;
          return (
            <StyledHeaderItem
              active={hasSelected || isOpen}
              icon={<StyledInlineSvg src="icon-stack" />}
              hasSelected={hasSelected}
              hasChanges={this.state.hasChanges}
              isOpen={isOpen}
              onSubmit={() => this.handleUpdate(actions)}
              onClear={this.handleClear}
              {...getActorProps()}
            >
              <MultipleProjectSelectorTitle
                showTeams={showTeams}
                teams={selectedTeams}
                projects={selectedProjects}
                loading={teamLoading}
              />
            </StyledHeaderItem>
          );
        }}
      </StyledProjectSelector>
    );
  }
}

const StyledProjectSelector = styled(ProjectSelector)`
  margin: 1px 0 0 -1px;
  border-radius: 0 0 4px 4px;
  width: 110%;
`;

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 300px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  height: 18px;
  width: 18px;
`;

export default MultipleProjectSelector;
