import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import Tooltip2 from 'app/components/tooltip2';
import withApi from 'app/utils/withApi';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import space from 'app/styles/space';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import OrganizationState from 'app/mixins/organizationState';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import InlineSvg from 'app/components/inlineSvg';
import Pagination from 'app/components/pagination';
import {sortProjects} from 'app/utils';
import {t} from 'app/locale';

const TeamProjects = createReactClass({
  displayName: 'TeamProjects',
  propTypes: {
    api: PropTypes.object,
  },
  mixins: [OrganizationState],

  getInitialState() {
    return {
      error: false,
      loading: true,
      pageLinks: null,
      unlinkedProjects: [],
      linkedProjects: [],
    };
  },

  componentDidMount() {
    this.fetchAll();
  },

  componentDidUpdate(prevProps) {
    if (
      prevProps.params.orgId !== this.props.params.orgId ||
      prevProps.params.teamId !== this.props.params.teamId
    ) {
      this.fetchAll();
    }

    if (prevProps.location !== this.props.location) {
      this.fetchTeamProjects();
    }
  },

  fetchAll() {
    this.fetchTeamProjects();
    this.fetchUnlinkedProjects();
  },

  fetchTeamProjects() {
    const {
      location,
      params: {orgId, teamId},
    } = this.props;

    this.setState({loading: true});

    this.props.api
      .requestPromise(`/organizations/${orgId}/projects/`, {
        query: {
          query: `team:${teamId}`,
          cursor: location.query.cursor || '',
        },
        includeAllArgs: true,
      })
      .then(([linkedProjects, _, jqXHR]) => {
        this.setState({
          loading: false,
          error: false,
          linkedProjects,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      })
      .catch(() => {
        this.setState({loading: false, error: true});
      });
  },

  fetchUnlinkedProjects(query) {
    const {
      params: {orgId, teamId},
    } = this.props;

    this.props.api
      .requestPromise(`/organizations/${orgId}/projects/`, {
        query: {
          query: query ? `!team:${teamId} ${query}` : `!team:${teamId}`,
        },
      })
      .then(unlinkedProjects => {
        this.setState({unlinkedProjects});
      });
  },

  handleLinkProject(project, action) {
    const {orgId, teamId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${project.slug}/teams/${teamId}/`, {
      method: action === 'add' ? 'POST' : 'DELETE',
      success: () => {
        this.fetchAll();
        addSuccessMessage(
          action === 'add'
            ? t('Successfully added project to team.')
            : t('Successfully removed project from team')
        );
      },
      error: e => {
        addErrorMessage(t("Wasn't able to change project association."));
      },
    });
  },

  handleProjectSelected(selection) {
    const project = this.state.unlinkedProjects.find(p => {
      return p.id === selection.value;
    });

    this.handleLinkProject(project, 'add');
  },

  handleQueryUpdate(evt) {
    this.fetchUnlinkedProjects(evt.target.value);
  },

  projectPanelContents(projects) {
    const access = this.getAccess();
    const canWrite = access.has('org:write');

    return projects.length ? (
      sortProjects(projects).map((project, i) => (
        <StyledPanelItem key={project.id}>
          <ProjectListItem project={project} organization={this.context.organization} />
          <Tooltip2
            disabled={canWrite}
            title={t('You do not have enough permission to change project association.')}
          >
            <Button
              size="small"
              disabled={!canWrite}
              onClick={() => {
                this.handleLinkProject(project, 'remove');
              }}
            >
              <RemoveIcon /> {t('Remove')}
            </Button>
          </Tooltip2>
        </StyledPanelItem>
      ))
    ) : (
      <EmptyMessage size="large" icon="icon-circle-exclamation">
        {t("This team doesn't have access to any projects.")}
      </EmptyMessage>
    );
  },

  render() {
    const {linkedProjects, unlinkedProjects, error, loading} = this.state;

    if (error) {
      return <LoadingError onRetry={() => this.fetchAll()} />;
    }

    if (loading) {
      return <LoadingIndicator />;
    }

    const access = this.getAccess();

    const otherProjects = unlinkedProjects.map(p => {
      return {
        value: p.id,
        searchKey: p.slug,
        label: <ProjectListElement>{p.slug}</ProjectListElement>,
      };
    });

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader hasButtons={true}>
            <div>{t('Projects')}</div>
            <div style={{textTransform: 'none'}}>
              {!access.has('org:write') ? (
                <DropdownButton
                  disabled
                  title={t('You do not have enough permission to associate a project.')}
                  size="xsmall"
                >
                  {t('Add Project')}
                </DropdownButton>
              ) : (
                <DropdownAutoComplete
                  items={otherProjects}
                  onChange={this.handleQueryUpdate}
                  onSelect={this.handleProjectSelected}
                  emptyMessage={t('No projects')}
                >
                  {({isOpen, selectedItem}) => (
                    <DropdownButton isOpen={isOpen} size="xsmall">
                      {t('Add Project')}
                    </DropdownButton>
                  )}
                </DropdownAutoComplete>
              )}
            </div>
          </PanelHeader>
          <PanelBody>{this.projectPanelContents(linkedProjects)}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} {...this.props} />
      </React.Fragment>
    );
  },
});

const RemoveIcon = styled(props => (
  <InlineSvg {...props} src="icon-circle-subtract">
    {t('Remove')}
  </InlineSvg>
))`
  min-height: 1.25em;
  min-width: 1.25em;
  margin-right: ${space(1)};
`;

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(2)};
`;

const ProjectListElement = styled('div')`
  padding: ${space(0.25)} 0;
`;

export {TeamProjects};

export default withApi(TeamProjects);
