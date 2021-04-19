import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ExternalLink from 'app/components/links/externalLink';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import {DebugFile} from 'app/types/debugFiles';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

import ProjectProguardRow from './projectProguardRow';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  mappings: DebugFile[];
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
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
    const {mappings} = this.state;
    const {organization, params} = this.props;
    const {orgId, projectId} = params;

    if (!mappings?.length) {
      return null;
    }

    return mappings.map(mapping => {
      const downloadUrl = `${
        this.api.baseUrl
      }/projects/${orgId}/${projectId}/files/dsyms/?id=${encodeURIComponent(mapping.id)}`;

      return (
        <ProjectProguardRow
          mapping={mapping}
          downloadUrl={downloadUrl}
          onDelete={this.handleDelete}
          downloadRole={organization.debugFilesRole}
          key={mapping.id}
        />
      );
    });
  }

  renderBody() {
    const {loading, mappings, mappingsPageLinks} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('ProGuard Mappings')}
          action={
            <SearchBar
              placeholder={t('Filter mappings')}
              onSearch={this.handleSearch}
              query={this.getQuery()}
              width="280px"
            />
          }
        />

        <TextBlock>
          {tct(
            `ProGuard mapping files are used to convert minified classes, methods and field names into a human readable format. To learn more about proguard mapping files, [link: read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/android/proguard/" />
              ),
            }
          )}
        </TextBlock>

        <StyledPanelTable
          headers={[
            t('Mapping'),
            <SizeColumn key="size">{t('File Size')}</SizeColumn>,
            '',
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
  grid-template-columns: minmax(220px, 1fr) max-content 120px;
`;

const SizeColumn = styled('div')`
  text-align: right;
`;

export default ProjectProguard;
