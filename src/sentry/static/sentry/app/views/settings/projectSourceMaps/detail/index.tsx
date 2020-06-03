import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import {Organization, Project, SourceMap} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import space from 'app/styles/space';
import {formatVersion} from 'app/utils/formatters';
import TextBlock from 'app/views/settings/components/text/textBlock';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconReleases, IconChevron} from 'app/icons';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';

import SourceMapsFileRow from './sourceMapsFileRow';

type RouteParams = {orgId: string; projectId: string; version: string};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  files: SourceMap[];
};

class ProjectSourceMaps extends AsyncView<Props, State> {
  getTitle() {
    const {projectId, version} = this.props.params;

    return routeTitleGen(t('Source Maps %s', formatVersion(version)), projectId, false);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      files: [],
    };
  }

  getEndpoints() {
    const {location} = this.props;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['files', this.getFilesUrl(), {query: {query: location.query.query}}],
    ];

    return endpoints;
  }

  getFilesUrl() {
    const {orgId, projectId, version} = this.props.params;

    return `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
      version
    )}/files/`;
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleDelete = async (id: string) => {
    addLoadingMessage(t('Removing file...'));

    try {
      await this.api.requestPromise(`${this.getFilesUrl()}${id}/`, {
        method: 'DELETE',
      });
      // We might want to refetch the files here to not mess up pagination
      this.setState(state => ({files: state.files.filter(f => f.id !== id)}));
      addSuccessMessage(t('File removed.'));
    } catch {
      addErrorMessage(t('Unable to remove file. Please try again.'));
    }
  };

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return t('There are no source maps that match your search.');
    }

    return t('There are no source maps for this release.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderFiles() {
    const {files} = this.state;
    const fileApiUrl = this.api.baseUrl + this.getFilesUrl();

    if (!files?.length) {
      return null;
    }

    return files.map(file => {
      return (
        <SourceMapsFileRow
          key={file.id}
          file={file}
          onDelete={this.handleDelete}
          downloadUrl={`${fileApiUrl}${file.id}/?download=1`}
        />
      );
    });
  }

  renderBody() {
    const {loading, files, filesPageLinks} = this.state;
    const {version, orgId, projectId} = this.props.params;
    const {project} = this.props;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={`${t('Source Maps in')} ${formatVersion(version)}`}
          action={
            <ButtonBar gap={1}>
              <Button
                size="small"
                to={`/settings/${orgId}/projects/${projectId}/source-maps/`}
                icon={<IconChevron size="xs" direction="left" />}
              >
                {t('All Source Maps')}
              </Button>
              <Button
                size="small"
                to={`/organizations/${orgId}/releases/${encodeURIComponent(
                  version
                )}/?project=${project.id}`}
                icon={<IconReleases size="xs" />}
              >
                {t('View Release')}
              </Button>
            </ButtonBar>
          }
        />

        <Wrapper>
          <TextBlock noMargin>{t('Uploaded source maps')}:</TextBlock>
          <SearchBar
            placeholder={t('Search source maps')}
            onSearch={this.handleSearch}
            query={this.getQuery()}
          />
        </Wrapper>

        <StyledPanelTable
          headers={[
            t('Name'),
            t('Size'),
            <TextRight key="actions">{t('Actions')}</TextRight>,
          ]}
          emptyMessage={this.getEmptyMessage()}
          isEmpty={files?.length === 0}
          isLoading={loading}
        >
          {this.renderFiles()}
        </StyledPanelTable>
        <Pagination pageLinks={filesPageLinks} />
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 100px 100px;
`;

const TextRight = styled('div')`
  text-align: right;
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: auto minmax(200px, 400px);
  grid-gap: ${space(4)};
  align-items: center;
  margin-bottom: ${space(1)};
  margin-top: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

export default ProjectSourceMaps;
