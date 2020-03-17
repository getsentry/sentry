import React from 'react';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import RepositoryFileSummary from 'app/components/repositoryFileSummary';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {CommitFile, Repository} from 'app/types';
import EmptyStateWarning from 'app/components/emptyStateWarning';

import {getFilesByRepository} from '../utils';
import ReleaseNoCommitData from '../releaseNoCommitData';

type Props = {
  params: Params;
} & AsyncComponent['props'];

type State = {
  fileList: CommitFile[];
  repos: Repository[];
} & AsyncComponent['state'];

class FilesChanged extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, release} = this.props.params;

    return [
      [
        'fileList',
        `/organizations/${orgId}/releases/${encodeURIComponent(release)}/commitfiles/`,
      ],
      ['repos', `/organizations/${orgId}/repos/`],
    ];
  }

  renderBody() {
    const {orgId} = this.props.params;
    const {fileList, repos} = this.state;
    const filesByRepository = getFilesByRepository(fileList);

    if (repos.length === 0) {
      return <ReleaseNoCommitData orgId={orgId} />;
    }

    return (
      <ContentBox>
        {fileList.length ? (
          Object.keys(filesByRepository).map(repository => (
            <RepositoryFileSummary
              key={repository}
              repository={repository}
              fileChangeSummary={filesByRepository[repository]}
            />
          ))
        ) : (
          <EmptyStateWarning small>{t('There are no changed files.')}</EmptyStateWarning>
        )}
      </ContentBox>
    );
  }
}

const ContentBox = styled('div')`
  padding: ${space(4)};
  flex: 1;
  background-color: ${p => p.theme.white};
`;

export default FilesChanged;
