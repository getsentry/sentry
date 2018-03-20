import React from 'react';

import AsyncView from '../views/asyncView';
import OrganizationHomeContainer from '../components/organizations/homeContainer';

import CommitRow from '../components/commitRow';
import Pagination from '../components/pagination';
import {t} from '../locale';

export default class OrganizationCommits extends AsyncView {
  getEndpoints() {
    return [
      ['commitList', `/organizations/${this.props.params.orgId}/members/me/commits/`],
    ];
  }

  getTitle() {
    return 'Commits';
  }

  emptyState() {
    return (
      <div className="box empty-stream m-y-0">
        <span className="icon icon-exclamation" />
        <p>We could find any commits associated with your account.</p>
        <p>
          Have you added (and verified) the email address associated with your activity?
        </p>
      </div>
    );
  }

  getCommitsByRepository(commitList) {
    let commitsByRepository = commitList.reduce(function(cbr, commit) {
      let {repository} = commit;
      if (!cbr.hasOwnProperty(repository.name)) {
        cbr[repository.name] = [];
      }

      cbr[repository.name].push(commit);
      return cbr;
    }, {});
    return commitsByRepository;
  }

  renderCommitsForRepo(repo, commitList) {
    let commitsByRepository = this.getCommitsByRepository(commitList);
    let activeCommits = commitsByRepository[repo];
    return (
      <div className="panel panel-default">
        <div className="panel-heading panel-heading-bold">{repo}</div>
        <ul className="list-group list-group-lg commit-list">
          {activeCommits.map(commit => {
            return <CommitRow key={commit.id} commit={commit} />;
          })}
        </ul>
      </div>
    );
  }

  renderBody() {
    let {commitList, commitListPageLinks} = this.state;
    if (!commitList.length) return this.emptyState();

    let unreleasedCommits = [],
      releasedCommits = [];
    let marker = false;
    commitList.forEach(commit => {
      if (marker) {
        releasedCommits.push(commit);
      } else if (commit.releases.length) {
        marker = true;
        releasedCommits.push(commit);
      } else {
        unreleasedCommits.push(commit);
      }
    });

    return (
      <div>
        {unreleasedCommits.length && (
          <div className="panel panel-default">
            <div className="panel-heading panel-heading-bold">Unreleased</div>
            <ul className="list-group list-group-lg commit-list">
              {unreleasedCommits.map(commit => {
                return <CommitRow key={commit.id} commit={commit} />;
              })}
            </ul>
          </div>
        )}
        {releasedCommits.length && (
          <div className="panel panel-default">
            <div className="panel-heading panel-heading-bold">Released</div>
            <ul className="list-group list-group-lg commit-list">
              {releasedCommits.map(commit => {
                return <CommitRow key={commit.id} commit={commit} />;
              })}
            </ul>
          </div>
        )}
        {commitListPageLinks && (
          <Pagination pageLinks={commitListPageLinks} {...this.props} />
        )}
      </div>
    );
  }

  render() {
    return (
      <OrganizationHomeContainer>
        <h4>{t('My Commits')}</h4>
        {this.renderComponent()}
      </OrganizationHomeContainer>
    );
  }
}
