import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Artifact, Organization, Project} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SourceMapsArtifactRow from './sourceMapsArtifactRow';

type RouteParams = {name: string; projectId: string};

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
    const {organization} = this.props;
    const {projectId, name} = this.props.params;

    return `/projects/${organization.slug}/${projectId}/releases/${encodeURIComponent(
      name
    )}/files/`;
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
    const {organization} = this.props;
    const {projectId, name} = this.props.params;

    addLoadingMessage(t('Removing artifacts\u2026'));

    try {
      await this.api.requestPromise(
        `/projects/${organization.slug}/${projectId}/files/source-maps/`,
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
          orgSlug={organization.slug}
        />
      );
    });
  }

  renderBody() {
    const {loading, artifacts, artifactsPageLinks} = this.state;
    const {name} = this.props.params;
    const {project, organization} = this.props;

    return (
      <Fragment>
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
                to={`/organizations/${organization.slug}/releases/${encodeURIComponent(
                  name
                )}/?project=${project.id}`}
              >
                {t('Go to Release')}
              </ReleaseButton>
              <Access access={['project:releases']}>
                {({hasAccess}) => (
                  <Tooltip
                    disabled={hasAccess}
                    title={t('You do not have permission to delete artifacts.')}
                  >
                    <Confirm
                      message={t(
                        'Are you sure you want to remove all artifacts in this archive?'
                      )}
                      onConfirm={this.handleArchiveDelete}
                      disabled={!hasAccess}
                    >
                      <Button
                        icon={<IconDelete size="sm" />}
                        title={t('Remove All Artifacts')}
                        aria-label={t('Remove All Artifacts')}
                        disabled={!hasAccess}
                      />
                    </Confirm>
                  </Tooltip>
                )}
              </Access>

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
      </Fragment>
    );
  }
}

const StyledSettingsPageHeader = styled(SettingsPageHeader)`
  /*
    ugly selector to make header work on mobile
    we can refactor this once we start making other settings more responsive
  */
  > div {
    @media (max-width: ${p => p.theme.breakpoints.large}) {
      display: block;
    }
    > div {
      min-width: 0;
      @media (max-width: ${p => p.theme.breakpoints.large}) {
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
