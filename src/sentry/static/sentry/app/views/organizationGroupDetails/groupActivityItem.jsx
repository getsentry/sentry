import PropTypes from 'prop-types';
import React from 'react';

import {t, tct, tn} from 'app/locale';
import CommitLink from 'app/components/commitLink';
import Duration from 'app/components/duration';
import MemberListStore from 'app/stores/memberListStore';
import PullRequestLink from 'app/components/pullRequestLink';
import TeamStore from 'app/stores/teamStore';
import Version from 'app/components/version';

class GroupActivityItem extends React.Component {
  static propTypes = {
    author: PropTypes.node,
    item: PropTypes.object,
    orgSlug: PropTypes.string,
    projectId: PropTypes.string,
  };

  render() {
    const {author, item, orgSlug, projectId} = this.props;
    const {data} = item;

    const issuesLink = `/organizations/${orgSlug}/issues/`;

    switch (item.type) {
      case 'note':
        return t('%s left a comment', author);
      case 'set_resolved':
        return t('%s marked this issue as resolved', author);
      case 'set_resolved_by_age':
        return t('%(author)s marked this issue as resolved due to inactivity', {
          author,
        });
      case 'set_resolved_in_release':
        return data.version
          ? t('%(author)s marked this issue as resolved in %(version)s', {
              author,
              version: (
                <Version version={data.version} projectId={projectId} tooltipRawVersion />
              ),
            })
          : t('%s marked this issue as resolved in the upcoming release', author);
      case 'set_resolved_in_commit':
        return t('%(author)s marked this issue as resolved in %(version)s', {
          author,
          version: (
            <CommitLink
              inline
              commitId={data.commit && data.commit.id}
              repository={data.commit && data.commit.repository}
            />
          ),
        });
      case 'set_resolved_in_pull_request':
        return t('%(author)s marked this issue as resolved in %(version)s', {
          author,
          version: (
            <PullRequestLink
              inline
              pullRequest={data.pullRequest}
              repository={data.pullRequest && data.pullRequest.repository}
            />
          ),
        });
      case 'set_unresolved':
        return t('%s marked this issue as unresolved', author);
      case 'set_ignored':
        if (data.ignoreDuration) {
          return t('%(author)s ignored this issue for %(duration)s', {
            author,
            duration: <Duration seconds={data.ignoreDuration * 60} />,
          });
        } else if (data.ignoreCount && data.ignoreWindow) {
          return tct(
            '[author] ignored this issue until it happens [count] time(s) in [duration]',
            {
              author,
              count: data.ignoreCount,
              duration: <Duration seconds={data.ignoreWindow * 60} />,
            }
          );
        } else if (data.ignoreCount) {
          return tct('[author] ignored this issue until it happens [count] time(s)', {
            author,
            count: data.ignoreCount,
          });
        } else if (data.ignoreUserCount && data.ignoreUserWindow) {
          return tct(
            '[author] ignored this issue until it affects [count] user(s) in [duration]',
            {
              author,
              count: data.ignoreUserCount,
              duration: <Duration seconds={data.ignoreUserWindow * 60} />,
            }
          );
        } else if (data.ignoreUserCount) {
          return tct('[author] ignored this issue until it affects [count] user(s)', {
            author,
            count: data.ignoreUserCount,
          });
        }
        return t('%s ignored this issue', author);
      case 'set_public':
        return t('%s made this issue public', author);
      case 'set_private':
        return t('%s made this issue private', author);
      case 'set_regression':
        return data.version
          ? t('%(author)s marked this issue as a regression in %(version)s', {
              author,
              version: (
                <Version version={data.version} projectId={projectId} tooltipRawVersion />
              ),
            })
          : t('%s marked this issue as a regression', author);
      case 'create_issue':
        return t('%(author)s created an issue on %(provider)s titled %(title)s', {
          author,
          provider: data.provider,
          title: <a href={data.location}>{data.title}</a>,
        });
      case 'unmerge_source':
        return tn(
          '%2$s migrated %1$s fingerprint to %3$s',
          '%2$s migrated %1$s fingerprints to %3$s',
          data.fingerprints.length,
          author,
          data.destination ? (
            <a href={`${issuesLink}${data.destination.id}`}>{data.destination.shortId}</a>
          ) : (
            t('a group')
          )
        );
      case 'unmerge_destination':
        return tn(
          '%2$s migrated %1$s fingerprint from %3$s',
          '%2$s migrated %1$s fingerprints from %3$s',
          data.fingerprints.length,
          author,
          data.source ? (
            <a href={`${issuesLink}${data.source.id}`}>{data.source.shortId}</a>
          ) : (
            t('a group')
          )
        );
      case 'first_seen':
        return t('%s first saw this issue', author);
      case 'assigned':
        let assignee;

        if (data.assigneeType === 'team') {
          const team = TeamStore.getById(data.assignee);
          assignee = team ? team.slug : '<unknown-team>';

          return t('%(author)s assigned this issue to #%(assignee)s', {
            author,
            assignee,
          });
        }

        if (item.user && data.assignee === item.user.id) {
          return t('%s assigned this issue to themselves', author);
        } else {
          assignee = MemberListStore.getById(data.assignee);
          if (assignee && assignee.email) {
            return t('%(author)s assigned this issue to %(assignee)s', {
              author,
              assignee: assignee.email,
            });
          } else {
            return t('%s assigned this issue to an unknown user', author);
          }
        }
      case 'unassigned':
        return t('%s unassigned this issue', author);
      case 'merge':
        return tn(
          '%2$s merged %1$s issue into this issue',
          '%2$s merged %1$s issues into this issue',
          data.issues.length,
          author
        );
      case 'reprocess':
        return t(
          '%(author)s reprocessed this issue, some events may have moved into new issues',
          {author}
        );
      default:
        return ''; // should never hit (?)
    }
  }
}

export default GroupActivityItem;
