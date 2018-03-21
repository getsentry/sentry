import React from 'react';

import AsyncView from '../views/asyncView';
import OrganizationHomeContainer from '../components/organizations/homeContainer';

import TimeSince from '../components/timeSince';
import CommitLink from '../components/commitLink';
import Pagination from '../components/pagination';
import {t} from '../locale';

export default class OrganizationCommits extends AsyncView {
  getEndpoints() {
    return [
      [
        'unreleasedCommits',
        `/organizations/${this.props.params.orgId}/members/me/unreleased-commits/`,
      ],
    ];
  }

  getTitle() {
    return 'Commits';
  }

  renderMessage = message => {
    if (!message) {
      return t('No message provided');
    }

    let firstLine = message.split(/\n/)[0];

    return firstLine;
  };

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

  renderBody() {
    let {unreleasedCommits, unreleasedCommitsPageLinks} = this.state;
    let {commits, repositories} = unreleasedCommits;
    if (!commits.length) return this.emptyState();

    return (
      <div>
        <div className="panel panel-default">
          <ul className="list-group list-group-lg commit-list">
            {commits.map(commit => {
              let repo = repositories[commit.repositoryID];
              return (
                <li className="list-group-item" key={commit.id}>
                  <div className="row row-center-vertically">
                    <div className="col-xs-10">
                      <h5 className="truncate">{this.renderMessage(commit.message)}</h5>
                      <p>
                        {repo.name} &mdash; <TimeSince date={commit.dateCreated} />
                      </p>
                    </div>
                    <div className="col-xs-2 hidden-xs align-right">
                      <CommitLink commitId={commit.id} repository={repo} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {!!unreleasedCommitsPageLinks && (
          <Pagination pageLinks={unreleasedCommitsPageLinks} {...this.props} />
        )}
      </div>
    );
  }

  render() {
    return (
      <OrganizationHomeContainer>
        <h4>
          {t('Unreleased Changes')} <small>Mine</small>
        </h4>
        {this.renderComponent()}
      </OrganizationHomeContainer>
    );
  }
}
