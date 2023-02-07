import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import FileChange from 'sentry/components/fileChange';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tn} from 'sentry/locale';
import {CommitFile, Organization, Project, Repository} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';

import {getFilesByRepository, getQuery, getReposToRender} from '../utils';

import EmptyState from './emptyState';
import RepositorySwitcher from './repositorySwitcher';
import withReleaseRepos from './withReleaseRepos';

type Props = RouteComponentProps<{release: string}, {}> & {
  location: Location;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  release: string;
  releaseRepos: Repository[];
  activeReleaseRepo?: Repository;
} & AsyncView['props'];

type State = {
  fileList: CommitFile[];
} & AsyncView['state'];

class FilesChanged extends AsyncView<Props, State> {
  getTitle() {
    const {params, orgSlug, projectSlug} = this.props;

    return routeTitleGen(
      t('Files Changed - Release %s', formatVersion(params.release)),
      orgSlug,
      false,
      projectSlug
    );
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      fileList: [],
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.activeReleaseRepo?.name !== this.props.activeReleaseRepo?.name) {
      this.remountComponent();
      return;
    }
    super.componentDidUpdate(prevProps, prevState);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {activeReleaseRepo: activeRepository, location, release, orgSlug} = this.props;

    const query = getQuery({location, activeRepository});

    return [
      [
        'fileList',
        `/organizations/${orgSlug}/releases/${encodeURIComponent(release)}/commitfiles/`,
        {query},
      ],
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderContent() {
    const {fileList, fileListPageLinks, loading} = this.state;
    const {activeReleaseRepo} = this.props;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!fileList.length) {
      return (
        <EmptyState>
          {!activeReleaseRepo
            ? t('There are no changed files associated with this release.')
            : t(
                'There are no changed files associated with this release in the %s repository.',
                activeReleaseRepo.name
              )}
        </EmptyState>
      );
    }

    const filesByRepository = getFilesByRepository(fileList);
    const reposToRender = getReposToRender(Object.keys(filesByRepository));

    return (
      <Fragment>
        {reposToRender.map(repoName => {
          const repoData = filesByRepository[repoName];
          const files = Object.keys(repoData);
          const fileCount = files.length;
          return (
            <Panel key={repoName}>
              <PanelHeader>
                <span>{repoName}</span>
                <span>{tn('%s file changed', '%s files changed', fileCount)}</span>
              </PanelHeader>
              <PanelBody>
                {files.map(filename => {
                  const {authors} = repoData[filename];
                  return (
                    <StyledFileChange
                      key={filename}
                      filename={filename}
                      authors={Object.values(authors)}
                    />
                  );
                })}
              </PanelBody>
            </Panel>
          );
        })}
        <Pagination pageLinks={fileListPageLinks} />
      </Fragment>
    );
  }

  renderBody() {
    const {activeReleaseRepo, releaseRepos, router, location} = this.props;
    return (
      <Fragment>
        {releaseRepos.length > 1 && (
          <RepositorySwitcher
            repositories={releaseRepos}
            activeRepository={activeReleaseRepo}
            location={location}
            router={router}
          />
        )}
        {this.renderContent()}
      </Fragment>
    );
  }

  renderComponent() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>{super.renderComponent()}</Layout.Main>
      </Layout.Body>
    );
  }
}

export default withReleaseRepos(FilesChanged);

const StyledFileChange = styled(FileChange)`
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  :last-child {
    border: none;
    border-radius: 0;
  }
`;
