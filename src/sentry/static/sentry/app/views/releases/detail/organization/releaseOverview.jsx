import PropTypes from 'prop-types';
import React from 'react';

import {Box} from 'grid-emotion';
import Button from 'app/components/button';
import IconOpen from 'app/icons/icon-open';
import HeroIcon from 'app/components/heroIcon';
import LastCommit from 'app/components/lastCommit';
// import IssueList from 'app/components/issueList';
import CommitAuthorStats from 'app/components/commitAuthorStats';
import ReleaseProjectStatSparkline from 'app/components/releaseProjectStatSparkline';
import RepositoryFileSummary from 'app/components/repositoryFileSummary';
import TimeSince from 'app/components/timeSince';
import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';
// import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import Well from 'app/components/well';

export default class OrganizationReleaseOverview extends AsyncView {
  static contextTypes = {
    release: PropTypes.object,
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

    // convert list of individual file changes (can be
    // multiple changes to a single file) into a per-file
    // summary grouped by repository
    const filesByRepository = fileList.reduce(function(fbr, file) {
      const {filename, repoName, author, type} = file;
      if (!fbr.hasOwnProperty(repoName)) {
        fbr[repoName] = {};
      }
      if (!fbr[repoName].hasOwnProperty(filename)) {
        fbr[repoName][filename] = {
          authors: {},
          types: new Set(),
          repos: new Set(),
        };
      }

      fbr[repoName][filename].authors[author.email] = author;
      fbr[repoName][filename].types.add(type);

      return fbr;
    }, {});

    const deploys = this.state.deploys;

    // TODO: Issue lists depend on organization issues endpoint
    // const query = {};

    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            {/**<h5>{t('Issues Resolved in this Release')}</h5>
            <IssueList
              endpoint={`/organizations/${orgId}/releases/${encodeURIComponent(
                version
              )}/resolved/`}
              query={query}
              pagination={false}
              renderEmpty={() => (
                <Panel>
                  <PanelBody>
                    <PanelItem key="none" justify="center">
                      {t('No issues resolved')}
                    </PanelItem>
                  </PanelBody>
                </Panel>
              )}
              showActions={false}
              params={{orgId}}
              className="m-b-2"
            />
            <h5>{t('New Issues in this Release')}</h5>
            <IssueList
              endpoint={`/organizations/${orgId}/issues/`}
              query={{
                ...query,
                query: 'first-release:"' + version + '"',
                limit: 5,
              }}
              statsPeriod="0"
              pagination={false}
              renderEmpty={() => (
                <Panel>
                  <PanelBody>
                    <PanelItem justify="center">{t('No new issues')}</PanelItem>
                  </PanelBody>
                </Panel>
              )}
              showActions={false}
              params={{orgId}}
              className="m-b-2"
              />**/}
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
              <Well centered className="m-t-2">
                <HeroIcon src="icon-commit" />
                <h5>Releases are better with commit data!</h5>
                <p>
                  Connect a repository to see commit info, files changed, and authors
                  involved in future releases.
                </p>
                <Box mb={1}>
                  <Button priority="primary" href={`/organizations/${orgId}/repos/`}>
                    Connect a repository
                  </Button>
                </Box>
              </Well>
            )}
            <h6 className="nav-header m-b-1">{t('Deploys')}</h6>
            <ul className="nav nav-stacked">
              {!deploys.length
                ? this.renderEmpty()
                : deploys.map(deploy => {
                    const href = `/organizations/${orgId}/issues/?query=release:${version}&environment=${encodeURIComponent(
                      deploy.environment
                    )}`;

                    return (
                      <li key={deploy.id}>
                        <a href={href} title={t('View in stream')}>
                          <div className="row row-flex row-center-vertically">
                            <div className="col-xs-6">
                              <span
                                className="repo-label"
                                style={{verticalAlign: 'bottom'}}
                              >
                                {deploy.environment}
                                <IconOpen
                                  className="icon-open"
                                  size={11}
                                  style={{marginLeft: 6}}
                                />
                              </span>
                            </div>
                            <div className="col-xs-6 align-right">
                              <small>
                                <TimeSince date={deploy.dateFinished} />
                              </small>
                            </div>
                          </div>
                        </a>
                      </li>
                    );
                  })}
            </ul>
          </div>
        </div>
      </div>
    );
  }
}
