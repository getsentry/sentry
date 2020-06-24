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
import {formatVersion} from 'app/utils/formatters';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconDelete} from 'app/icons';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {decodeScalar} from 'app/utils/queryString';
import Confirm from 'app/components/confirm';

import SourceMapsArtifactRow from './sourceMapsArtifactRow';

type RouteParams = {orgId: string; projectId: string; name: string};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  artifacts: Artifact[];
};

class ProjectSourceMaps extends AsyncView<Props, State> {
  getTitle() {
    const {projectId, name} = this.props.params;

    return routeTitleGen(t('Source Maps %s', formatVersion(name)), projectId, false);
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
    const {orgId, projectId, name} = this.props.params;

    return `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(name)}/files/`;
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleArtifactDelete = async (id: string) => {
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

  handleArchiveDelete = async () => {
    const {router, params} = this.props;
    const {orgId, projectId, name} = params;

    addLoadingMessage(t('Removing archive\u2026'));

    try {
      await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/files/source-maps/`,
        {
          method: 'DELETE',
          query: {name},
        }
      );
      addSuccessMessage(t('Archive removed.'));
      router.replace(`/settings/${orgId}/projects/${projectId}/source-maps/`);
    } catch {
      addErrorMessage(t('Unable to remove archive. Please try again.'));
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

    return t('There are no artifacts in this archive.');
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
          onDelete={this.handleArtifactDelete}
          downloadUrl={`${artifactApiUrl}${artifact.id}/?download=1`}
        />
      );
    });
  }

  renderBody() {
    const {loading, artifacts, artifactsPageLinks} = this.state;
    const {name, orgId} = this.props.params;
    const {project} = this.props;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Archive %s', formatVersion(name))}
          action={
            <ButtonBar gap={1}>
              <ReleaseButton
                to={`/organizations/${orgId}/releases/${encodeURIComponent(
                  name
                )}/?project=${project.id}`}
              >
                {t('Go to Release')}
              </ReleaseButton>
              <Confirm
                message={t(
                  'Are you sure you want to remove all artifacts in this archive?'
                )}
                onConfirm={this.handleArchiveDelete}
              >
                <Button icon={<IconDelete size="sm" />} />
              </Confirm>
              <SearchBar
                placeholder={t('Filter artifacts')}
                onSearch={this.handleSearch}
                query={this.getQuery()}
              />
            </ButtonBar>
          }
        />

        <StyledPanelTable
          headers={[
            t('Artifact'),
            <SizeColumn key="size">{t('File Size')}</SizeColumn>,
            '',
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
  grid-template-columns: 1fr max-content 120px;
`;

const ReleaseButton = styled(Button)`
  white-space: nowrap;
`;

const SizeColumn = styled('div')`
  text-align: right;
`;

export default ProjectSourceMaps;
