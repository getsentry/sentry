import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization, Project, SourceMapsArchive} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import TextBlock from 'app/views/settings/components/text/textBlock';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import {decodeScalar} from 'app/utils/queryString';
import {
  addLoadingMessage,
  addSuccessMessage,
  addErrorMessage,
} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import space from 'app/styles/space';

import SourceMapsArchiveRow from './sourceMapsArchiveRow';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  archives: SourceMapsArchive[];
};

class ProjectSourceMaps extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Source Maps'), projectId, false);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      archives: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['archives', this.getArchivesUrl(), {query: {query: this.getQuery()}}]];
  }

  getArchivesUrl() {
    const {orgId, projectId} = this.props.params;

    return `/projects/${orgId}/${projectId}/files/source-maps/`;
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleDelete = async (name: string) => {
    addLoadingMessage(t('Removing artifacts\u2026'));
    try {
      await this.api.requestPromise(this.getArchivesUrl(), {
        method: 'DELETE',
        query: {name},
      });
      this.fetchData();
      addSuccessMessage(t('Artifacts removed.'));
    } catch {
      addErrorMessage(t('Unable to remove artifacts. Please try again.'));
    }
  };

  getQuery() {
    const {query} = this.props.location.query;

    return decodeScalar(query);
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return t('There are no archives that match your search.');
    }

    return t('There are no archives for this project.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderArchives() {
    const {archives} = this.state;
    const {params} = this.props;
    const {orgId, projectId} = params;

    if (!archives.length) {
      return null;
    }

    return archives.map(a => {
      return (
        <SourceMapsArchiveRow
          key={a.name}
          archive={a}
          orgId={orgId}
          projectId={projectId}
          onDelete={this.handleDelete}
        />
      );
    });
  }

  renderBody() {
    const {loading, archives, archivesPageLinks} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Source Maps')}
          action={
            <SearchBar
              placeholder={t('Filter Archives')}
              onSearch={this.handleSearch}
              query={this.getQuery()}
              width="280px"
            />
          }
        />

        <TextBlock>
          {tct(
            `These source map archives help Sentry identify where to look when Javascript is minified. By providing this information, you can get better context for your stack traces when debugging. To learn more about source maps, [link: read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/" />
              ),
            }
          )}
        </TextBlock>

        <StyledPanelTable
          headers={[
            t('Archive'),
            <ArtifactsColumn key="artifacts">{t('Artifacts')}</ArtifactsColumn>,
            t('Type'),
            t('Date Created'),
            '',
          ]}
          emptyMessage={this.getEmptyMessage()}
          isEmpty={archives.length === 0}
          isLoading={loading}
        >
          {this.renderArchives()}
        </StyledPanelTable>
        <Pagination pageLinks={archivesPageLinks} />
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns:
    minmax(120px, 1fr) max-content minmax(85px, max-content) minmax(265px, max-content)
    75px;
`;

const ArtifactsColumn = styled('div')`
  text-align: right;
  padding-right: ${space(1.5)};
  margin-right: ${space(0.25)};
`;

export default ProjectSourceMaps;
