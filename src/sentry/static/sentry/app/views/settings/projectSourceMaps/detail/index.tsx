import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import {Organization, Project, Artifact} from 'app/types';
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
import {decodeScalar} from 'app/utils/queryString';

import SourceMapsArtifactRow from './sourceMapsArtifactRow';

type RouteParams = {orgId: string; projectId: string; version: string};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  artifacts: Artifact[];
};

class ProjectSourceMaps extends AsyncView<Props, State> {
  getTitle() {
    const {projectId, version} = this.props.params;

    return routeTitleGen(t('Source Maps %s', formatVersion(version)), projectId, false);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      artifacts: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['artifacts', this.getArtifactsUrl(), {query: {query: this.getQuery()}}]];
  }

  getArtifactsUrl() {
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
    addLoadingMessage(t('Removing artifact\u2026'));

    try {
      await this.api.requestPromise(`${this.getArtifactsUrl()}${id}/`, {
        method: 'DELETE',
      });
      this.fetchData();
      addSuccessMessage(t('Artifact removed.'));
    } catch {
      addErrorMessage(t('Unable to remove artifact. Please try again.'));
    }
  };

  getQuery() {
    const {query} = this.props.location.query;

    return decodeScalar(query);
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return t('There are no artifacts that match your search.');
    }

    return t('There are no artifacts for this release.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderArtifacts() {
    const {artifacts} = this.state;
    const artifactApiUrl = this.api.baseUrl + this.getArtifactsUrl();

    if (!artifacts.length) {
      return null;
    }

    return artifacts.map(artifact => {
      return (
        <SourceMapsArtifactRow
          key={artifact.id}
          artifact={artifact}
          onDelete={this.handleDelete}
          downloadUrl={`${artifactApiUrl}${artifact.id}/?download=1`}
        />
      );
    });
  }

  renderBody() {
    const {loading, artifacts, artifactsPageLinks} = this.state;
    const {version, orgId, projectId} = this.props.params;
    const {project} = this.props;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Source Maps Archive %s', formatVersion(version))}
          action={
            <ButtonBar gap={1}>
              <Button
                size="small"
                to={`/settings/${orgId}/projects/${projectId}/source-maps/`}
                icon={<IconChevron size="xs" direction="left" />}
              >
                {t('All Archives')}
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
          <TextBlock noMargin>{t('Uploaded artifacts')}:</TextBlock>
          <SearchBar
            placeholder={t('Filter artifacts')}
            onSearch={this.handleSearch}
            query={this.getQuery()}
          />
        </Wrapper>

        <StyledPanelTable
          headers={[
            t('Artifact'),
            t('Size'),
            <Actions key="actions">{t('Actions')}</Actions>,
          ]}
          emptyMessage={this.getEmptyMessage()}
          isEmpty={artifacts.length === 0}
          isLoading={loading}
        >
          {this.renderArtifacts()}
        </StyledPanelTable>
        <Pagination pageLinks={artifactsPageLinks} />
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 100px 150px;
`;

const Actions = styled('div')`
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
