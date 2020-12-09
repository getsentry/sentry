import React from 'react';

import CommitLink from 'app/components/commitLink';
import Duration from 'app/components/duration';
import Link from 'app/components/links/link';
import PullRequestLink from 'app/components/pullRequestLink';
import Version from 'app/components/version';
import {t, tct, tn} from 'app/locale';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';
import {
  GroupActivity,
  GroupActivityAssigned,
  GroupActivitySetIgnored,
  GroupActivityType,
  Organization,
  Project,
  User,
} from 'app/types';

type Props = {
  author: React.ReactNode;
  activity: GroupActivity;
  orgSlug: Organization['slug'];
  projectId: Project['id'];
};

function GroupActivityItem({author, activity, orgSlug, projectId}: Props) {
  const issuesLink = `/organizations/${orgSlug}/issues/`;

  function getIgnoredMessage(data: GroupActivitySetIgnored['data']) {
    if (data.ignoreDuration) {
      return t('%(author)s ignored this issue for %(duration)s', {
        author,
        duration: <Duration seconds={data.ignoreDuration * 60} />,
      });
    }

    if (data.ignoreCount && data.ignoreWindow) {
      return tct(
        '[author] ignored this issue until it happens [count] time(s) in [duration]',
        {
          author,
          count: data.ignoreCount,
          duration: <Duration seconds={data.ignoreWindow * 60} />,
        }
      );
    }

    if (data.ignoreCount) {
      return tct('[author] ignored this issue until it happens [count] time(s)', {
        author,
        count: data.ignoreCount,
      });
    }

    if (data.ignoreUserCount && data.ignoreUserWindow) {
      return tct(
        '[author] ignored this issue until it affects [count] user(s) in [duration]',
        {
          author,
          count: data.ignoreUserCount,
          duration: <Duration seconds={data.ignoreUserWindow * 60} />,
        }
      );
    }

    if (data.ignoreUserCount) {
      return tct('[author] ignored this issue until it affects [count] user(s)', {
        author,
        count: data.ignoreUserCount,
      });
    }

    return t('%s ignored this issue', author);
  }

  function getAssignedMessage(data: GroupActivityAssigned['data']) {
    let assignee: string | User | undefined = undefined;

    if (data.assigneeType === 'team') {
      const team = TeamStore.getById(data.assignee);
      assignee = team ? team.slug : '<unknown-team>';

      return t('%(author)s assigned this issue to #%(assignee)s', {
        author,
        assignee,
      });
    }

    if (activity.user && activity.assignee === activity.user.id) {
      return t('%s assigned this issue to themselves', author);
    }

    assignee = MemberListStore.getById(data.assignee);

    if (typeof assignee === 'object' && assignee?.email) {
      return t('%(author)s assigned this issue to %(assignee)s', {
        author,
        assignee: assignee.email,
      });
    }

    return t('%s assigned this issue to an unknown user', author);
  }

  function renderContent() {
    switch (activity.type) {
      case GroupActivityType.NOTE:
        return t('%s left a comment', author);
      case GroupActivityType.SET_RESOLVED:
        return t('%s marked this issue as resolved', author);
      case GroupActivityType.SET_RESOLVED_BY_AGE:
        return t('%(author)s marked this issue as resolved due to inactivity', {
          author,
        });
      case GroupActivityType.SET_RESOLVED_IN_RELEASE:
        return activity.data.version
          ? t('%(author)s marked this issue as resolved in %(version)s', {
              author,
              version: (
                <Version
                  version={activity.data.version}
                  projectId={projectId}
                  tooltipRawVersion
                />
              ),
            })
          : t('%s marked this issue as resolved in the upcoming release', author);
      case GroupActivityType.SET_RESOLVED_IN_COMMIT:
        return t('%(author)s marked this issue as resolved in %(version)s', {
          author,
          version: (
            <CommitLink
              inline
              commitId={activity.data.commit.id}
              repository={activity.data.commit.repository}
            />
          ),
        });
      case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST: {
        const {data} = activity;
        const {pullRequest} = data;
        return t('%(author)s marked this issue as resolved in %(version)s', {
          author,
          version: (
            <PullRequestLink
              inline
              pullRequest={pullRequest}
              repository={pullRequest.repository}
            />
          ),
        });
      }
      case GroupActivityType.SET_UNRESOLVED:
        return t('%s marked this issue as unresolved', author);
      case GroupActivityType.SET_IGNORED: {
        const {data} = activity;
        return getIgnoredMessage(data);
      }
      case GroupActivityType.SET_PUBLIC:
        return t('%s made this issue public', author);
      case GroupActivityType.SET_PRIVATE:
        return t('%s made this issue private', author);
      case GroupActivityType.SET_REGRESSION: {
        const {data} = activity;
        return data.version
          ? t('%(author)s marked this issue as a regression in %(version)s', {
              author,
              version: (
                <Version version={data.version} projectId={projectId} tooltipRawVersion />
              ),
            })
          : t('%s marked this issue as a regression', author);
      }
      case GroupActivityType.CREATE_ISSUE: {
        const {data} = activity;
        return t('%(author)s created an issue on %(provider)s titled %(title)s', {
          author,
          provider: data.provider,
          title: <Link to={data.location}>{data.title}</Link>,
        });
      }
      case GroupActivityType.UNMERGE_SOURCE: {
        const {data} = activity;
        const {destination, fingerprints} = data;
        return tn(
          '%2$s migrated %1$s fingerprint to %3$s',
          '%2$s migrated %1$s fingerprints to %3$s',
          fingerprints.length,
          author,
          destination ? (
            <Link to={`${issuesLink}${destination.id}`}>{destination.shortId}</Link>
          ) : (
            t('a group')
          )
        );
      }
      case GroupActivityType.UNMERGE_DESTINATION: {
        const {data} = activity;
        const {source, fingerprints} = data;
        return tn(
          '%2$s migrated %1$s fingerprint from %3$s',
          '%2$s migrated %1$s fingerprints from %3$s',
          fingerprints.length,
          author,
          source ? (
            <Link to={`${issuesLink}${source.id}`}>{source.shortId}</Link>
          ) : (
            t('a group')
          )
        );
      }
      case GroupActivityType.FIRST_SEEN:
        return t('%s first saw this issue', author);
      case GroupActivityType.ASSIGNED: {
        const {data} = activity;
        return getAssignedMessage(data);
      }
      case GroupActivityType.UNASSIGNED:
        return t('%s unassigned this issue', author);
      case GroupActivityType.MERGE:
        return tn(
          '%2$s merged %1$s issue into this issue',
          '%2$s merged %1$s issues into this issue',
          activity.data.issues.length,
          author
        );
      case GroupActivityType.REPROCESS:
        return t(
          '%(author)s reprocessed this issue, some events may have moved into new issues',
          {author}
        );
      default:
        return ''; // should never hit (?)
    }
  }

  return <React.Fragment>{renderContent()}</React.Fragment>;
}

export default GroupActivityItem;
