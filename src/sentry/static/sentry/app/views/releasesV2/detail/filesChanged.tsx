import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {t, tn} from 'app/locale';
import {CommitFile, Repository} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import {formatVersion} from 'app/utils/formatters';
import withApi from 'app/utils/withApi';
import {Main} from 'app/components/layouts/thirds';
import Pagination from 'app/components/pagination';
import AsyncView from 'app/views/asyncView';
import {PanelHeader, Panel, PanelBody} from 'app/components/panels';
import FileChange from 'app/components/fileChange';

import {getFilesByRepository, getReposToRender, getQuery} from './utils';
import withRepositories from './withRepositories';
import RepositorySwitcher from './repositorySwitcher';
import EmptyState from './emptyState';

type Props = RouteComponentProps<{orgId: string; release: string}, {}> & {
  api: Client;
  repositories: Array<Repository>;
  projectSlug: string;
  activeRepository?: Repository;
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

  getEndpoints = (): ReturnType<AsyncView['getEndpoints']> => {
    const {params, activeRepository, location} = this.props;
    const {orgId, release} = params;
    const query = getQuery({location, activeRepository});

    return [
      [
        'fileList',
        `/organizations/${orgId}/releases/${encodeURIComponent(release)}/commitfiles/`,
        {query},
      ],
    ];
  };

  renderContent() {
    const {fileList, fileListPageLinks} = this.state;
    const {activeRepository} = this.props;

    if (!fileList.length) {
      return (
        <EmptyState>
          {!activeRepository
            ? t('There are no changed files associated with this release.')
            : t(
                'There are no changed files associated with this release in the %s repository.',
                activeRepository.name
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
    const {activeRepository, router, repositories, location} = this.props;
    return (
      <React.Fragment>
        {repositories.length > 1 && (
          <RepositorySwitcher
            repositories={repositories}
            activeRepository={activeRepository}
            location={location}
            router={router}
          />
        )}
        {this.renderContent()}
      </React.Fragment>
    );
  }

  renderComponent() {
    return <Main fullWidth>{super.renderComponent()}</Main>;
  }
}

export default withApi(withRepositories(FilesChanged));

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
