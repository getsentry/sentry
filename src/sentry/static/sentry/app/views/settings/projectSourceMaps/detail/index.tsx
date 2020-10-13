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
import Version from 'app/components/version';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

import SourceMapsArtifactRow from './sourceMapsArtifactRow';

type RouteParams = {orgId: string; projectId: string; name: string};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  artifacts: Artifact[];
};

class ProjectSourceMapsDetail extends AsyncView<Props, State> {
  getTitle() {
    const {projectId, name} = this.props.params;

    return routeTitleGen(t('Archive %s', formatVersion(name)), projectId, false);
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
    const {orgId, projectId, name} = this.props.params;

    addLoadingMessage(t('Removing artifacts\u2026'));

    try {
      await this.api.requestPromise(
        `/projects/${orgId}/${projectId}/files/source-maps/`,
        {
          method: 'DELETE',
          query: {name},
        }
      );
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
      return t('There are no artifacts that match your search.');
    }

    return t('There are no artifacts in this archive.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderArtifacts() {
    const {organization} = this.props;
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
          downloadRole={organization.debugFilesRole}
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
        <StyledSettingsPageHeader
          title={
            <Title>
              {t('Archive')}&nbsp;
              <TextOverflow>
                <Version version={name} tooltipRawVersion anchor={false} truncate />
              </TextOverflow>
            </Title>
          }
          action={
            <StyledButtonBar gap={1}>
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
                <Button
                  icon={<IconDelete size="sm" />}
                  title={t('Remove All Artifacts')}
                  label={t('Remove All Artifacts')}
                />
              </Confirm>
              <SearchBar
                placeholder={t('Filter artifacts')}
                onSearch={this.handleSearch}
                query={this.getQuery()}
              />
            </StyledButtonBar>
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

const StyledSettingsPageHeader = styled(SettingsPageHeader)`
  /*
    ugly selector to make header work on mobile
    we can refactor this once we start making other settings more responsive
  */
  > div {
    @media (max-width: ${p => p.theme.breakpoints[2]}) {
      display: block;
    }
    > div {
      min-width: 0;
      @media (max-width: ${p => p.theme.breakpoints[2]}) {
        margin-bottom: ${space(2)};
      }
    }
  }
`;

const Title = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledButtonBar = styled(ButtonBar)`
  justify-content: flex-start;
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(220px, 1fr) max-content 120px;
`;

const ReleaseButton = styled(Button)`
  white-space: nowrap;
`;

const SizeColumn = styled('div')`
  text-align: right;
`;

export default ProjectSourceMapsDetail;
