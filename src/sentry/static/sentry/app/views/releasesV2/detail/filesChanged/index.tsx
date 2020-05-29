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
import Button from 'app/components/button';

import {getFilesByRepository} from '../utils';
import ReleaseNoCommitData from '../releaseNoCommitData';

import {ReleaseContext} from '..';

const FILES_LIMIT = 200;

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
        {
          query: {
            limit: this.shouldFetchAll() ? null : FILES_LIMIT,
          },
        },
      ],
      ['repos', `/organizations/${orgId}/repos/`],
    ];
  }

  shouldFetchAll() {
    const {location} = this.props;

    return location.query.full === '1';
  }

  renderBody() {
    const {params, location} = this.props;
    const {orgId} = params;
    const {fileList, repos} = this.state;
    const filesByRepository = getFilesByRepository(fileList);

    if (repos.length === 0) {
      return <ReleaseNoCommitData orgId={orgId} />;
    }

    return (
      <ContentBox>
        {fileList.length ? (
          <React.Fragment>
            {Object.entries(filesByRepository).map(([repository, file]) => (
              <RepositoryFileSummary
                key={repository}
                repository={repository}
                fileChangeSummary={file}
                collapsable={false}
              />
            ))}

            <ReleaseContext.Consumer>
              {({releaseMeta}) =>
                !this.shouldFetchAll() && releaseMeta.commitFilesChanged > FILES_LIMIT ? (
                  <ShowAllWrapper>
                    <Button
                      priority="primary"
                      size="small"
                      to={{
                        pathname: location.pathname,
                        query: {...location.query, full: 1},
                      }}
                    >
                      {t('Show all')}
                    </Button>
                  </ShowAllWrapper>
                ) : null
              }
            </ReleaseContext.Consumer>
          </React.Fragment>
        ) : (
          <Panel>
            <PanelBody>
              <EmptyStateWarning small>
                {t('There are no changed files.')}
              </EmptyStateWarning>
            </PanelBody>
          </Panel>
        )}
      </ContentBox>
    );
  }
}

const ContentBox = styled('div')`
  h5 {
    color: ${p => p.theme.gray3};
    font-size: ${p => p.theme.fontSizeMedium};
    margin-bottom: ${space(1.5)};
  }
`;

const ShowAllWrapper = styled('div')`
  text-align: center;
`;

export default withOrganization(FilesChanged);
