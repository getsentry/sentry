import React from 'react';
import PropTypes from 'prop-types';

import SentryTypes from 'app/sentryTypes';
import LastCommit from 'app/components/lastCommit';

import RepositoryFileSummary from 'app/components/repositoryFileSummary';
import AsyncComponent from 'app/components/asyncComponent';
import {t} from 'app/locale';

import {getFilesByRepository} from './utils';
import ReleaseDeploys from './releaseDeploys';
import ReleaseEmptyState from './releaseEmptyState';
import ReleaseIssues from './releaseIssues';
import CommitAuthorStats from './commitAuthorStats';
import ReleaseProjectStatSparkline from './releaseProjectStatSparkline';

export default class ReleaseOverview extends AsyncComponent {
  static propTypes = {
    release: SentryTypes.Release,
    query: PropTypes.object,
  };

  getEndpoints() {
    const {orgId, version} = this.props.params;
    const basePath = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`;
    return [
      ['fileList', `${basePath}commitfiles/`],
      ['deploys', `${basePath}deploys/`],
      ['repos', `/organizations/${orgId}/repos/`],
    ];
  }

  renderEmpty() {
    return <div className="box empty">{t('None')}</div>;
  }

  renderBody() {
    const {
      release,
      query,
      params: {orgId, version},
    } = this.props;

    const {fileList, repos} = this.state;

    const hasRepos = repos.length > 0;

    const filesByRepository = getFilesByRepository(fileList);

    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <ReleaseIssues version={version} orgId={orgId} query={query} />
            {hasRepos && (
              <div>
                {Object.keys(filesByRepository).map((repository, i) => {
                  return (
                    <RepositoryFileSummary
                      key={i}
                      repository={repository}
                      fileChangeSummary={filesByRepository[repository]}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="col-sm-4">
            {hasRepos ? (
              <div>
                {release.lastCommit && (
                  <LastCommit commit={release.lastCommit} headerClass="nav-header" />
                )}
                <CommitAuthorStats orgId={orgId} version={version} />
                <h6 className="nav-header m-b-1">{t('Projects Affected')}</h6>
                <ul className="nav nav-stacked">
                  {release.projects.length === 0
                    ? this.renderEmpty()
                    : release.projects.map(project => {
                        return (
                          <ReleaseProjectStatSparkline
                            key={project.slug}
                            orgId={orgId}
                            project={project}
                            version={version}
                          />
                        );
                      })}
                </ul>
              </div>
            ) : (
              <ReleaseEmptyState />
            )}
            <ReleaseDeploys
              deploys={this.state.deploys}
              version={version}
              orgId={orgId}
            />
          </div>
        </div>
      </div>
    );
  }
}
