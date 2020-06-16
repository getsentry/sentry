import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Pagination from 'app/components/pagination';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import Checkbox from 'app/components/checkbox';
import SearchBar from 'app/components/searchBar';
// TODO(android-mappings): use own components once we decide how this should look like
import DebugFileRow from 'app/views/settings/projectDebugFiles/debugFileRow';
import {DebugFile} from 'app/views/settings/projectDebugFiles/types';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  mappings: DebugFile[];
  showDetails: boolean;
};

class ProjectProguard extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('ProGuard Mappings'), projectId, false);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      mappings: [],
      showDetails: false,
    };
  }

  getEndpoints() {
    const {params, location} = this.props;
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'mappings',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {query: {query: location.query.query, file_formats: 'proguard'}},
      ],
    ];

    return endpoints;
  }

  handleDelete = (id: string) => {
    const {orgId, projectId} = this.props.params;

    this.setState({
      loading: true,
    });

    this.api.request(
      `/projects/${orgId}/${projectId}/files/dsyms/?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        complete: () => this.fetchData(),
      }
    );
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
      return t('There are no mappings that match your search.');
    }

    return t('There are no mappings for this project.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMappings() {
    const {mappings, showDetails} = this.state;
    const {orgId, projectId} = this.props.params;

    if (!mappings?.length) {
      return null;
    }

    return mappings.map(mapping => {
      const downloadUrl = `${
        this.api.baseUrl
      }/projects/${orgId}/${projectId}/files/dsyms/?id=${encodeURIComponent(mapping.id)}`;

      return (
        <DebugFileRow
          debugFile={mapping}
          showDetails={showDetails}
          downloadUrl={downloadUrl}
          onDelete={this.handleDelete}
          key={mapping.id}
        />
      );
    });
  }

  renderBody() {
    const {loading, showDetails, mappings, mappingsPageLinks} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('ProGuard Mappings')} />

        <TextBlock>
          {t(
            `ProGuard mapping files are used to convert minified classes, methods and field names into a human readable format.`
          )}
        </TextBlock>

        <Wrapper>
          <TextBlock noMargin>{t('Uploaded mappings')}:</TextBlock>

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
              placeholder={t('Search mappings')}
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
          isEmpty={mappings?.length === 0}
          isLoading={loading}
        >
          {this.renderMappings()}
        </StyledPanelTable>
        <Pagination pageLinks={mappingsPageLinks} />
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

export default ProjectProguard;
