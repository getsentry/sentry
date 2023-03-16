import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import ExternalLink from 'sentry/components/links/externalLink';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project, SourceMapsArchive} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import SourceMapsArchiveRow from './sourceMapsArchiveRow';

type Props = RouteComponentProps<{projectId: string}, {}> & {
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
    const {organization, project} = this.props;

    return `/projects/${organization.slug}/${project.slug}/files/source-maps/`;
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
    if (!archives.length) {
      return null;
    }
    const {organization, project} = this.props;

    return archives.map(a => {
      return (
        <SourceMapsArchiveRow
          key={a.name}
          archive={a}
          orgId={organization.slug}
          projectId={project.slug}
          onDelete={this.handleDelete}
        />
      );
    });
  }

  renderBody() {
    const {loading, archives, archivesPageLinks} = this.state;

    return (
      <Fragment>
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
      </Fragment>
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
