import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tn} from 'sentry/locale';
import {CommitFile, Organization, Project, Repository} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import routeTitleGen from 'sentry/utils/routeTitle';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

import {getFilesByRepository, getQuery, getReposToRender} from '../utils';

import EmptyState from './emptyState';
import FileChange from './fileChange';
import RepositorySwitcher from './repositorySwitcher';
import withReleaseRepos from './withReleaseRepos';

type Props = RouteComponentProps<{release: string}, {}> & {
  location: Location;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  release: string;
  releaseRepos: Repository[];
  activeReleaseRepo?: Repository;
} & DeprecatedAsyncView['props'];

type State = {
  fileList: CommitFile[];
} & DeprecatedAsyncView['state'];

class FilesChanged extends DeprecatedAsyncView<Props, State> {
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

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
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
                    <FileChange
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
