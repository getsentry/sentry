import React from 'react';
import AsyncComponent from 'app/components/asyncComponent';
import TimeSince from 'app/components/timeSince';
import CommitLink from 'app/components/commitLink';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel} from 'app/components/panels';

import {t} from 'app/locale';

export default class UnreleasedChanges extends AsyncComponent {
  getEndpoints() {
    return [
      [
        'unreleasedCommits',
        `/organizations/${this.props.params.orgId}/members/me/unreleased-commits/`,
      ],
    ];
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
      <Panel>
        <EmptyStateWarning>
          <p>
            {t("We couldn't find any unreleased commits associated with your account.")}
          </p>
        </EmptyStateWarning>
      </Panel>
    );
  }

  missingEmails() {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t("We couldn't find any commits associated with your account.")}</p>
          <p>
            <small>
              {t(
                'Have you added (and verified) the email address associated with your activity?'
              )}
            </small>
          </p>
        </EmptyStateWarning>
      </Panel>
    );
  }

  renderBody() {
    let {unreleasedCommits} = this.state;
    let {commits, errors, repositories} = unreleasedCommits;

    if (errors && errors.missing_emails) return this.missingEmails();
    if (!commits.length) return this.emptyState();
    return (
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
    );
  }

  render() {
    return (
      <div>
        <h4>{t('Unreleased Changes')}</h4>
        {this.renderComponent()}
      </div>
    );
  }
}
