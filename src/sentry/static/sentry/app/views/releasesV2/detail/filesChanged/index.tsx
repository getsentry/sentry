import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import RepositoryFileSummary from 'app/components/repositoryFileSummary';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {CommitFile, Repository, Organization} from 'app/types';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import AsyncView from 'app/views/asyncView';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {formatVersion} from 'app/utils/formatters';
import {Panel, PanelBody} from 'app/components/panels';
import {Main} from 'app/components/layouts/thirds';

import {getFilesByRepository} from '../utils';
import ReleaseNoCommitData from '../releaseNoCommitData';

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = {
  fileList: CommitFile[];
  repos: Repository[];
} & AsyncComponent['state'];

class FilesChanged extends AsyncView<Props, State> {
  getTitle() {
    const {params, organization} = this.props;
    return routeTitleGen(
      t('Files Changed - Release %s', formatVersion(params.release)),
      organization.slug,
      false
    );
  }

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
      <React.Fragment>
        {fileList.length ? (
          Object.keys(filesByRepository).map(repository => (
            <RepositoryFileSummary
              key={repository}
              repository={repository}
              fileChangeSummary={filesByRepository[repository]}
              collapsable={false}
            />
          ))
        ) : (
          <Panel>
            <PanelBody>
              <EmptyStateWarning small>
                {t('There are no changed files.')}
              </EmptyStateWarning>
            </PanelBody>
          </Panel>
        )}
      </React.Fragment>
    );
  }

  renderComponent() {
    return <StyledMain fullWidth>{super.renderComponent()}</StyledMain>;
  }
}

const StyledMain = styled(Main)`
  h5 {
    color: ${p => p.theme.gray600};
    font-size: ${p => p.theme.fontSizeMedium};
    margin-bottom: ${space(1.5)};
  }
`;

export default withOrganization(FilesChanged);
