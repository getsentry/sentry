import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import ProjectActions from 'app/actions/projectActions';
import Checkbox from 'app/components/checkbox';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource, CustomRepo, DebugFile} from 'app/types/debugFiles';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/project/permissionAlert';

import DebugFileRow from './debugFileRow';
import ExternalSources from './externalSources';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  debugFiles: DebugFile[] | null;
  showDetails: boolean;
  project: Project;
  builtinSymbolSources?: BuiltinSymbolSource[] | null;
};

class ProjectDebugSymbols extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Debug Files'), projectId, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      project: this.props.project,
      showDetails: false,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, params, location} = this.props;
    const {builtinSymbolSources} = this.state || {};
    const {orgId, projectId} = params;
    const {query} = location.query;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'debugFiles',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {
          query: {
            query,
            file_formats: [
              'breakpad',
              'macho',
              'elf',
              'pe',
              'pdb',
              'sourcebundle',
              'wasm',
              'bcsymbolmap',
              'uuidmap',
            ],
          },
        },
      ],
    ];

    if (!builtinSymbolSources && organization.features.includes('symbol-sources')) {
      endpoints.push(['builtinSymbolSources', '/builtin-symbol-sources/', {}]);
    }

    return endpoints;
  }

  handleDelete = (id: string) => {
    const {orgId, projectId} = this.props.params;

    this.setState({
      loading: true,
    });

    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/?id=${id}`, {
      method: 'DELETE',
      complete: () => this.fetchData(),
    });
  };

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  async fetchProject() {
    const {params} = this.props;
    const {orgId, projectId} = params;
    try {
      const updatedProject = await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/`
      );
      ProjectActions.updateSuccess(updatedProject);
    } catch {
      addErrorMessage(t('An error occured while fetching project data'));
    }
  }

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return t('There are no debug symbols that match your search.');
    }

    return t('There are no debug symbols for this project.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderDebugFiles() {
    const {debugFiles, showDetails} = this.state;
    const {organization, params} = this.props;
    const {orgId, projectId} = params;

    if (!debugFiles?.length) {
      return null;
    }

    return debugFiles.map(debugFile => {
      const downloadUrl = `${this.api.baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${debugFile.id}`;

      return (
        <DebugFileRow
          debugFile={debugFile}
          showDetails={showDetails}
          downloadUrl={downloadUrl}
          downloadRole={organization.debugFilesRole}
          onDelete={this.handleDelete}
          key={debugFile.id}
        />
      );
    });
  }

  renderBody() {
    const {organization, project, router, location} = this.props;
    const {loading, showDetails, builtinSymbolSources, debugFiles, debugFilesPageLinks} =
      this.state;
    const {features} = organization;

    return (
      <Fragment>
        <SettingsPageHeader title={t('Debug Information Files')} />

        <TextBlock>
          {t(`
            Debug information files are used to convert addresses and minified
            function names from native crash reports into function names and
            locations.
          `)}
        </TextBlock>

        {features.includes('symbol-sources') && (
          <Fragment>
            <PermissionAlert />
            <ExternalSources
              api={this.api}
              location={location}
              router={router}
              projectSlug={project.slug}
              organization={organization}
              customRepositories={
                (project.symbolSources
                  ? JSON.parse(project.symbolSources)
                  : []) as CustomRepo[]
              }
              builtinSymbolSources={project.builtinSymbolSources ?? []}
              builtinSymbolSourceOptions={builtinSymbolSources ?? []}
            />
          </Fragment>
        )}

        <Wrapper>
          <TextBlock noMargin>{t('Uploaded debug information files')}</TextBlock>

          <Filters>
            <Label>
              <Checkbox
                checked={showDetails}
                onChange={e => {
                  this.setState({showDetails: (e.target as HTMLInputElement).checked});
                }}
              />
              {t('show details')}
            </Label>

            <SearchBar
              placeholder={t('Search DIFs')}
              onSearch={this.handleSearch}
              query={this.getQuery()}
            />
          </Filters>
        </Wrapper>

        <StyledPanelTable
          headers={[
            t('Debug ID'),
            t('Information'),
            <Actions key="actions">{t('Actions')}</Actions>,
          ]}
          emptyMessage={this.getEmptyMessage()}
          isEmpty={debugFiles?.length === 0}
          isLoading={loading}
        >
          {this.renderDebugFiles()}
        </StyledPanelTable>
        <Pagination pageLinks={debugFilesPageLinks} />
      </Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 37% 1fr auto;
`;

const Actions = styled('div')`
  text-align: right;
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: ${space(4)};
  align-items: center;
  margin-top: ${space(4)};
  margin-bottom: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

const Filters = styled('div')`
  display: grid;
  grid-template-columns: min-content minmax(200px, 400px);
  align-items: center;
  justify-content: flex-end;
  grid-gap: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: min-content 1fr;
  }
`;

const Label = styled('label')`
  font-weight: normal;
  display: flex;
  margin-bottom: 0;
  white-space: nowrap;
  input {
    margin-top: 0;
    margin-right: ${space(1)};
  }
`;

export default ProjectDebugSymbols;
