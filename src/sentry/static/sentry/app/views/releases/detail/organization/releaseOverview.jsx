import React from 'react';

import SentryTypes from 'app/sentryTypes';

import LastCommit from 'app/components/lastCommit';
import CommitAuthorStats from 'app/components/commitAuthorStats';
import ReleaseProjectStatSparkline from 'app/components/releaseProjectStatSparkline';
import RepositoryFileSummary from 'app/components/repositoryFileSummary';
import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';
import {getFilesByRepository} from '../shared/utils';
import ReleaseDeploys from '../shared/releaseDeploys';
import ReleaseEmptyState from '../shared/releaseEmptyState';
import ReleaseIssues from '../shared/releaseIssues';

export default class OrganizationReleaseOverview extends AsyncView {
  static contextTypes = {
    release: SentryTypes.Release,
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
    const {orgId, version} = this.props.params;
    const {release} = this.context;

    const {fileList, repos} = this.state;

    const hasRepos = repos.length > 0;

    const filesByRepository = getFilesByRepository(fileList);

    // Unlike project releases) which filter issue lists on environment, we
    // do not apply any of the global selection filters (project, environment,
    // or time) to the organization release
    const query = {};

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
                            key={project.id}
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
