import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {PanelTable} from 'app/components/panels';
import {fields} from 'app/data/forms/projectDebugFiles';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import Pagination from 'app/components/pagination';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import Checkbox from 'app/components/checkbox';
import SearchBar from 'app/components/searchBar';
import ProjectActions from 'app/actions/projectActions';

import {DebugFile, BuiltinSymbolSource} from './types';
import DebugFileRow from './debugFileRow';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  debugFiles: DebugFile[];
  builtinSymbolSources?: BuiltinSymbolSource[];
  showDetails: boolean;
};

class ProjectDebugSymbols extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Debug Files'), projectId, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      showDetails: false,
    };
  }

  getEndpoints() {
    const {organization, params, location} = this.props;
    const {builtinSymbolSources} = this.state || {};
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'debugFiles',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {
          query: {
            query: location.query.query,
            file_formats: organization.features.includes('android-mappings')
              ? ['breakpad', 'macho', 'elf', 'pe', 'pdb', 'sourcebundle']
              : undefined,
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
    const {organization, project, params} = this.props;
    const {
      loading,
      showDetails,
      builtinSymbolSources,
      debugFiles,
      debugFilesPageLinks,
    } = this.state;
    const {orgId, projectId} = params;
    const {features, access} = organization;

    const fieldProps = {
      organization,
      builtinSymbolSources: builtinSymbolSources || [],
    };

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Debug Information Files')} />

        <TextBlock>
          {t(`
            Debug information files are used to convert addresses and minified
            function names from native crash reports into function names and
            locations.
          `)}
        </TextBlock>

        {features.includes('symbol-sources') && (
          <React.Fragment>
            <PermissionAlert />

            <Form
              saveOnBlur
              allowUndo
              initialData={project}
              apiMethod="PUT"
              apiEndpoint={`/projects/${orgId}/${projectId}/`}
              onSubmitSuccess={ProjectActions.updateSuccess}
              key={project.builtinSymbolSources?.join() || project.id}
            >
              <JsonForm
                features={new Set(features)}
                title={t('External Sources')}
                disabled={!access.includes('project:write')}
                fields={[fields.symbolSources, fields.builtinSymbolSources]}
                additionalFieldProps={fieldProps}
              />
            </Form>
          </React.Fragment>
        )}

        <Wrapper>
          <TextBlock noMargin>{t('Uploaded debug information files')}:</TextBlock>

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
      </React.Fragment>
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
