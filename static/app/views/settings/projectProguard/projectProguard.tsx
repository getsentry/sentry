import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {DebugFile} from 'sentry/types/debugFiles';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import ProjectProguardRow from './projectProguardRow';

type Props = RouteComponentProps<{projectId: string}, {}> & {
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
    const {organization, params, location} = this.props;
    const {projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'mappings',
        `/projects/${organization.slug}/${projectId}/files/dsyms/`,
        {query: {query: location.query.query, file_formats: 'proguard'}},
      ],
    ];

    return endpoints;
  }

  handleDelete = (id: string) => {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    this.setState({
      loading: true,
    });

    this.api.request(
      `/projects/${organization.slug}/${projectId}/files/dsyms/?id=${encodeURIComponent(
        id
      )}`,
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
    const {projectId} = params;

    if (!mappings?.length) {
      return null;
    }

    return mappings.map(mapping => {
      const downloadUrl = `${this.api.baseUrl}/projects/${
        organization.slug
      }/${projectId}/files/dsyms/?id=${encodeURIComponent(mapping.id)}`;

      return (
        <ProjectProguardRow
          mapping={mapping}
          downloadUrl={downloadUrl}
          onDelete={this.handleDelete}
          downloadRole={organization.debugFilesRole}
          key={mapping.id}
          orgSlug={organization.slug}
        />
      );
    });
  }

  renderBody() {
    const {loading, mappings, mappingsPageLinks} = this.state;

    return (
      <Fragment>
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
      </Fragment>
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
