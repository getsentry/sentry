import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {fetchTeams} from 'app/actionCreators/teams';
import {getProjectSelectorType} from 'app/components/projectSelector/utils';
import {t} from 'app/locale';
import HeaderItem from 'app/components/organizations/headerItem';
import InlineSvg from 'app/components/inlineSvg';
import ProjectSelector from 'app/components/projectSelector';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

const rootContainerStyles = css`
  display: flex;
`;

class MultipleProjectSelector extends React.PureComponent {
  static propTypes = {
    value: PropTypes.shape({
      projects: PropTypes.arrayOf(SentryTypes.Project),
      teams: PropTypes.arrayOf(SentryTypes.Team),
    }),
    projects: PropTypes.arrayOf(SentryTypes.Project),
    teams: PropTypes.arrayOf(SentryTypes.Team),
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

    console.log('all projects', Array.from(allProjects));
    onChange({
      [type]: changed,
      allProjects: Array.from(allProjects),
    });

    this.setState({hasChanges: true});
  };

  render() {
    const {value, projects, teams, ...props} = this.props;
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
        multi
        teams={teams}
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
          const title = hasSelected
            ? [
                ...selectedTeams.map(({slug}) => `#${slug}`),
                ...selectedProjects.map(({slug}) => slug),
              ].join(', ')
            : t('All Projects');
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
              {title}
            </StyledHeaderItem>
          );
        }}
      </StyledProjectSelector>
    );
  }
}

const FetchTeams = withRouter(
  withApi(
    class FetchTeams extends React.Component {
      static propTypes = {
        showTeams: PropTypes.bool,
        api: PropTypes.object,
        teams: PropTypes.arrayOf(SentryTypes.Team),
        router: PropTypes.object,
      };

      constructor() {
        super();
        this.state = {
          teams: null,
        };
      }

      componentDidMount() {
        const {showTeams, api, router} = this.props;
        if (!showTeams) {
          return;
        }

        fetchTeams(api, router.params).then(
          teams => this.setState({teams}),
          () => addErrorMessage(t('Error fetching teams'))
        );
      }

      render() {
        const {showTeams} = this.props;
        const teams = showTeams ? this.state.teams : this.props.teams;
        return <MultipleProjectSelector {...this.props} teams={teams} />;
      }
    }
  )
);

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

export default FetchTeams;
