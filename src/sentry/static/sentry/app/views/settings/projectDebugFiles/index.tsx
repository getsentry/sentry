import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {PanelTable, PanelTableHeader} from 'app/components/panels';
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

import {DebugFile, BuiltinSymbolSource} from './types';
import DebugFileRow from './debugFileRow';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  debugFiles: DebugFile[];
  builtinSymbolSources?: BuiltinSymbolSource[];
};

class ProjectDebugSymbols extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Debug Files'), projectId, false);
  }

  getEndpoints() {
    const {organization, params, location} = this.props;
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'debugFiles',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {query: {query: location.query.query}},
      ],
    ];

    if (organization.features.includes('symbol-sources')) {
      endpoints.push(['builtinSymbolSources', '/builtin-symbol-sources/']);
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

  renderDebugFiles() {
    const {debugFiles} = this.state;
    const {orgId, projectId} = this.props.params;

    return debugFiles.map(debugFile => {
      const downloadUrl = `${this.api.baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?id=${debugFile.id}`;

      return (
        <DebugFileRow
          debugFile={debugFile}
          downloadUrl={downloadUrl}
          onDelete={this.handleDelete}
          key={debugFile.id}
        />
      );
    });
  }

  renderBody() {
    const {organization, project, params} = this.props;
    const {builtinSymbolSources, debugFiles, debugFilesPageLinks} = this.state;
    const {orgId, projectId} = params;
    const {features, access} = organization;

    const fieldProps = {
      organization,
      builtinSymbolSources,
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

        <TextBlock>
          {t('This list contains all uploaded debug information files:')}
        </TextBlock>

        <StyledPanelTable
          headers={[
            t('Debug ID'),
            t('Name'),
            this.renderSearchInput({
              updateRoute: true,
              placeholder: t('Search DIFs'),
            }),
          ]}
          emptyMessage={t('There are no debug symbols for this project.')}
          isEmpty={debugFiles.length === 0}
        >
          {this.renderDebugFiles()}
        </StyledPanelTable>

        <Pagination pageLinks={debugFilesPageLinks} />
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 1.3fr auto;
  ${PanelTableHeader} {
    padding: ${space(1)} ${space(2)};
    display: flex;
    align-items: center;
  }
`;

export default ProjectDebugSymbols;
