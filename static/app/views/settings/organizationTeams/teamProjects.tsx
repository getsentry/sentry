import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconFlag, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import ProjectListItem from 'sentry/views/settings/components/settingsProjectItem';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{orgId: string; teamId: string}, {}>;

type State = {
  error: boolean;
  linkedProjects: Project[];
  loading: boolean;
  pageLinks: null | string;
  unlinkedProjects: Project[];
};

type DropdownAutoCompleteProps = React.ComponentProps<typeof DropdownAutoComplete>;
type Item = Parameters<NonNullable<DropdownAutoCompleteProps['onSelect']>>[0];

class TeamProjects extends Component<Props, State> {
  state: State = {
    error: false,
    loading: true,
    pageLinks: null,
    unlinkedProjects: [],
    linkedProjects: [],
  };

  componentDidMount() {
    this.fetchAll();
  }

  componentDidUpdate(prevProps: Props) {
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
      .then(([linkedProjects, _, resp]) => {
        this.setState({
          loading: false,
          error: false,
          linkedProjects,
          pageLinks: resp?.getResponseHeader('Link') ?? null,
        });
      })
      .catch(() => {
        this.setState({loading: false, error: true});
      });
  }

  fetchUnlinkedProjects(query = '') {
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
  }

  handleLinkProject = (project: Project, action: string) => {
    const {orgId, teamId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${project.slug}/teams/${teamId}/`, {
      method: action === 'add' ? 'POST' : 'DELETE',
      success: resp => {
        this.fetchAll();
        ProjectsStore.onUpdateSuccess(resp);
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

  handleProjectSelected = (selection: Item) => {
    const project = this.state.unlinkedProjects.find(p => p.id === selection.value);
    if (project) {
      this.handleLinkProject(project, 'add');
    }
  };

  handleQueryUpdate = (evt: React.ChangeEvent<HTMLInputElement>) => {
    this.fetchUnlinkedProjects(evt.target.value);
  };

  projectPanelContents(projects: Project[]) {
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
              size="sm"
              disabled={!canWrite}
              icon={<IconSubtract isCircled size="xs" />}
              aria-label={t('Remove')}
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
                  size="xs"
                >
                  {t('Add Project')}
                </DropdownButton>
              ) : (
                <DropdownAutoComplete
                  items={otherProjects}
                  onChange={this.handleQueryUpdate}
                  onSelect={this.handleProjectSelected}
                  emptyMessage={t('No projects')}
                  alignMenu="right"
                >
                  {({isOpen}) => (
                    <DropdownButton isOpen={isOpen} size="xs">
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
