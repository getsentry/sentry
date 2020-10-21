import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {sortProjects} from 'app/utils';
import {IconFlag, IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import ProjectActions from 'app/actions/projectActions';
import ProjectListItem from 'app/views/settings/components/settingsProjectItem';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

class TeamProjects extends Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  state = {
    error: false,
    loading: true,
    pageLinks: null,
    unlinkedProjects: [],
    linkedProjects: [],
  };

  componentDidMount() {
    this.fetchAll();
  }

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
  }

  fetchAll = () => {
    this.fetchTeamProjects();
    this.fetchUnlinkedProjects();
  };

  fetchTeamProjects = () => {
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
  };

  fetchUnlinkedProjects = query => {
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
  };

  handleLinkProject = (project, action) => {
    const {orgId, teamId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${project.slug}/teams/${teamId}/`, {
      method: action === 'add' ? 'POST' : 'DELETE',
      success: resp => {
        this.fetchAll();
        ProjectActions.updateSuccess(resp);
        addSuccessMessage(
          action === 'add'
            ? t('Successfully added project to team.')
            : t('Successfully removed project from team')
        );
      },
      error: () => {
        addErrorMessage(t("Wasn't able to change project association."));
      },
    });
  };

  handleProjectSelected = selection => {
    const project = this.state.unlinkedProjects.find(p => p.id === selection.value);

    this.handleLinkProject(project, 'add');
  };

  handleQueryUpdate = evt => {
    this.fetchUnlinkedProjects(evt.target.value);
  };

  projectPanelContents(projects) {
    const {organization} = this.props;
    const access = new Set(organization.access);
    const canWrite = access.has('org:write');

    return projects.length ? (
      sortProjects(projects).map(project => (
        <StyledPanelItem key={project.id}>
          <ProjectListItem project={project} organization={organization} />
          <Tooltip
            disabled={canWrite}
            title={t('You do not have enough permission to change project association.')}
          >
            <Button
              size="small"
              disabled={!canWrite}
              icon={<IconSubtract isCircled size="xs" />}
              onClick={() => {
                this.handleLinkProject(project, 'remove');
              }}
            >
              {t('Remove')}
            </Button>
          </Tooltip>
        </StyledPanelItem>
      ))
    ) : (
      <EmptyMessage size="large" icon={<IconFlag size="xl" />}>
        {t("This team doesn't have access to any projects.")}
      </EmptyMessage>
    );
  }

  render() {
    const {linkedProjects, unlinkedProjects, error, loading} = this.state;

    if (error) {
      return <LoadingError onRetry={() => this.fetchAll()} />;
    }

    if (loading) {
      return <LoadingIndicator />;
    }

    const access = new Set(this.props.organization.access);

    const otherProjects = unlinkedProjects.map(p => ({
      value: p.id,
      searchKey: p.slug,
      label: <ProjectListElement>{p.slug}</ProjectListElement>,
    }));

    return (
      <Fragment>
        <Panel>
          <PanelHeader hasButtons>
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
                  {({isOpen}) => (
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
      </Fragment>
    );
  }
}

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

export default withApi(withOrganization(TeamProjects));
