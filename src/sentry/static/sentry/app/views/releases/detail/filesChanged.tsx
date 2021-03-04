import React from 'react';
import {InjectedRouter, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import FileChange from 'app/components/fileChange';
import {Body, Main} from 'app/components/layouts/thirds';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tn} from 'app/locale';
import {CommitFile, Organization, Repository} from 'app/types';
import {formatVersion} from 'app/utils/formatters';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';

import EmptyState from './emptyState';
import RepositorySwitcher from './repositorySwitcher';
import {getFilesByRepository, getQuery, getReposToRender} from './utils';
import withReleaseRepos from './withReleaseRepos';

type Props = RouteComponentProps<{orgId: string; release: string}, {}> & {
  location: Location;
  router: InjectedRouter;
  orgSlug: Organization['slug'];
  release: string;
  releaseRepos: Repository[];
  activeReleaseRepo?: Repository;
} & AsyncView['props'];

type State = {
  fileList: CommitFile[];
} & AsyncView['state'];

class FilesChanged extends AsyncView<Props, State> {
  getTitle() {
    const {params} = this.props;
    const {orgId} = params;

    return routeTitleGen(
      t('Files Changed - Release %s', formatVersion(params.release)),
      orgId,
      false
    );
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      fileList: [],
    };
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

  renderContent() {
    const {fileList, fileListPageLinks} = this.state;
    const {activeReleaseRepo} = this.props;

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
      <React.Fragment>
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
      </React.Fragment>
    );
  }

  renderBody() {
    const {activeReleaseRepo, releaseRepos, router, location} = this.props;
    return (
      <React.Fragment>
        {releaseRepos.length > 1 && (
          <RepositorySwitcher
            repositories={releaseRepos}
            activeRepository={activeReleaseRepo}
            location={location}
            router={router}
          />
        )}
        {this.renderContent()}
      </React.Fragment>
    );
  }

  renderComponent() {
    return (
      <Body>
        <Main fullWidth>{super.renderComponent()}</Main>
      </Body>
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
