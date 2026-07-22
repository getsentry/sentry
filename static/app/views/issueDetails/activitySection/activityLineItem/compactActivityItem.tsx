import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {Link} from '@sentry/scraps/link';

import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {t, tct, tn} from 'sentry/locale';
import type {
  GroupActivity,
  GroupActivitySetEscalating,
  IssueCategory,
} from 'sentry/types/group';
import {GroupActivityType, IssueCategory as IssueCategoryEnum} from 'sentry/types/group';
import type {PullRequest} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatDuration} from 'sentry/utils/duration/formatDuration';

import {CommitChip} from './chips/commitChip';
import {ExternalIssueChip} from './chips/externalIssueChip';
import {getIntegrationChip} from './chips/integrationChip';
import {ActivityPriorityChip} from './chips/priorityChip';
import {PullRequestChip, SeerPullRequestChip} from './chips/pullRequestChip';
import {ActivityRelease} from './chips/releaseChip';
import {getAssignedActivityItem} from './compactActivityItem/assignment';
import {getResolvedInCommitDetails} from './compactActivityItem/commitDetails';
import {getProviderName} from './compactActivityItem/provider';
import {getResolvedInReleaseDetails} from './compactActivityItem/releaseDetails';
import type {CompactGroupActivityItem} from './compactActivityItem/types';
import {getArchiveDetails} from './archiveDetails';

export type {CompactGroupActivityItem} from './compactActivityItem/types';

function getNoteAuthorName(item: GroupActivity) {
  if (item.sentry_app) {
    return item.sentry_app.name;
  }
  if (item.user) {
    return item.user.name;
  }
  return 'Sentry';
}

function getPullRequestProvider(pullRequest: PullRequest) {
  return getProviderName(
    pullRequest.repository.provider?.name ?? pullRequest.repository.provider?.id
  );
}

function formatAutoResolveAge(age: number | string | undefined) {
  const resolveAge = Number(age);
  if (!Number.isFinite(resolveAge) || resolveAge <= 0) {
    return null;
  }

  const precision = resolveAge > 23 && resolveAge % 24 === 0 ? 'day' : 'hour';
  const count = Number(
    formatDuration({duration: [resolveAge, 'hour'], precision, style: 'count'})
  );

  return precision === 'day'
    ? tn('%s day', '%s days', count)
    : tn('%s hour', '%s hours', count);
}

function getEscalatingDetails(data: GroupActivitySetEscalating['data']) {
  if (data.forecast) {
    return tct('after more than [forecast] [event] in an hour', {
      forecast: data.forecast,
      event: data.forecast === 1 ? t('event') : t('events'),
    });
  }

  if (data.expired_snooze?.count && data.expired_snooze.window) {
    return tct('after reaching [count] [event] within [duration]', {
      count: data.expired_snooze.count,
      event: data.expired_snooze.count === 1 ? t('event') : t('events'),
      duration: <Duration seconds={data.expired_snooze.window * 60} />,
    });
  }

  if (data.expired_snooze?.count) {
    return tn('after %s more event', 'after %s more events', data.expired_snooze.count);
  }

  if (data.expired_snooze?.user_count && data.expired_snooze.user_window) {
    return tct('after affecting [count] [user] within [duration]', {
      count: data.expired_snooze.user_count,
      user: data.expired_snooze.user_count === 1 ? t('user') : t('users'),
      duration: <Duration seconds={data.expired_snooze.user_window * 60} />,
    });
  }

  if (data.expired_snooze?.user_count) {
    return tn(
      'after affecting %s more user',
      'after affecting %s more users',
      data.expired_snooze.user_count
    );
  }

  if (data.expired_snooze?.until) {
    return tct('after the archive expired on [date]', {
      date: <DateTime date={data.expired_snooze.until} />,
    });
  }

  return null;
}

function getPriorityDetails(
  data: Extract<GroupActivity, {type: GroupActivityType.SET_PRIORITY}>['data']
) {
  const priority = <ActivityPriorityChip priority={data.priority} />;

  switch (data.reason) {
    case 'escalating':
      return tct('to [priority] when it escalated', {priority});
    case 'ongoing':
      return tct('to [priority] after becoming ongoing', {priority});
    default:
      return tct('to [priority]', {priority});
  }
}

interface GetCompactGroupActivityItemParams {
  activity: GroupActivity;
  issueCategory: IssueCategory;
  organization: Organization;
  project: Project;
}

export function getCompactGroupActivityItem({
  activity,
  organization,
  project,
  issueCategory,
}: GetCompactGroupActivityItemParams): CompactGroupActivityItem {
  const issuesLink = `/organizations/${organization.slug}/issues/`;
  const activityContext = {id: activity.id, type: activity.type};

  switch (activity.type) {
    case GroupActivityType.NOTE:
      return {
        title: getNoteAuthorName(activity),
      };
    case GroupActivityType.SET_RESOLVED: {
      const integrationChip = getIntegrationChip({data: activity.data, organization});
      return {
        title: t('Resolved'),
        details: integrationChip
          ? tct('via [integration]', {integration: integrationChip})
          : undefined,
      };
    }
    case GroupActivityType.SET_RESOLVED_BY_AGE: {
      const duration = formatAutoResolveAge(activity.data.age);
      return {
        title: t('Resolved'),
        details: duration
          ? tct('after [duration] of inactivity', {duration})
          : t('due to inactivity'),
      };
    }
    case GroupActivityType.SET_RESOLVED_IN_RELEASE: {
      return {
        title: t('Resolved'),
        details: getResolvedInReleaseDetails(activity, organization, project),
      };
    }
    case GroupActivityType.SET_RESOLVED_IN_COMMIT:
      return {
        title: t('Resolved'),
        details: getResolvedInCommitDetails(activity, organization, project),
      };
    case GroupActivityType.REFERENCED_IN_COMMIT: {
      const commit = activity.data.commit;
      if (!commit) {
        return {title: t('Referenced in commit')};
      }

      return {
        title: t('Referenced in'),
        details: (
          <Fragment>
            {tct('[commit] on [provider]', {
              commit: <CommitChip commit={commit} />,
              provider: getProviderName(
                commit.repository?.provider?.name ?? commit.repository?.provider?.id
              ),
            })}
            {commit.pullRequest &&
              tct(' via [pullRequest]', {
                pullRequest: <PullRequestChip pullRequest={commit.pullRequest} />,
              })}
          </Fragment>
        ),
      };
    }
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: t('Referenced in pull request'),
        details: pullRequest
          ? tct('[pullRequest] on [provider]', {
              provider: getPullRequestProvider(pullRequest),
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : null,
      };
    }
    case GroupActivityType.PULL_REQUEST_CLOSED: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: pullRequest
          ? tct('Pull request [pullRequest] closed', {
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : t('Pull request closed'),
        details: pullRequest
          ? tct('on [provider]', {
              provider: getPullRequestProvider(pullRequest),
            })
          : null,
      };
    }
    case GroupActivityType.PULL_REQUEST_REOPENED: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: pullRequest
          ? tct('Pull request [pullRequest] reopened', {
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : t('Pull request reopened'),
        details: pullRequest
          ? tct('on [provider]', {
              provider: getPullRequestProvider(pullRequest),
            })
          : null,
      };
    }
    case GroupActivityType.PULL_REQUEST_MERGED: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: pullRequest
          ? tct('Pull request [pullRequest] merged', {
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : t('Pull request merged'),
        details: pullRequest
          ? tct('on [provider]', {
              provider: getPullRequestProvider(pullRequest),
            })
          : null,
      };
    }
    case GroupActivityType.PULL_REQUEST_UNLINKED: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: pullRequest
          ? tct('Pull request [pullRequest] unlinked', {
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : t('Pull request unlinked'),
        details: pullRequest
          ? tct('on [provider]', {
              provider: getPullRequestProvider(pullRequest),
            })
          : null,
      };
    }
    case GroupActivityType.SET_UNRESOLVED: {
      if ('forecast' in activity.data && activity.data.forecast) {
        return {
          title: t('Escalated'),
          details: tct('after more than [forecast] [event] in an hour', {
            forecast: activity.data.forecast,
            event: activity.data.forecast === 1 ? t('event') : t('events'),
          }),
        };
      }

      const integrationChip = getIntegrationChip({data: activity.data, organization});
      return {
        title: t('Marked as unresolved'),
        details: integrationChip
          ? tct('via [integration]', {integration: integrationChip})
          : null,
      };
    }
    case GroupActivityType.SET_IGNORED:
      return {
        title:
          issueCategory === IssueCategoryEnum.FEEDBACK
            ? t('Marked as spam')
            : t('Archived'),
        details: getArchiveDetails(activity.data, issueCategory),
      };
    case GroupActivityType.SET_PUBLIC:
      return {
        title: t('Made public'),
      };
    case GroupActivityType.SET_PRIVATE:
      return {
        title: t('Made private'),
      };
    case GroupActivityType.SET_REGRESSION: {
      const {data} = activity;
      const comparison =
        data.version && data.resolved_in_version && 'follows_semver' in data
          ? tct(' compared with [resolvedVersion] based on [comparison]', {
              resolvedVersion: (
                <ActivityRelease
                  organization={organization}
                  project={project}
                  version={data.resolved_in_version}
                />
              ),
              comparison: data.follows_semver ? t('SemVer') : t('release order'),
            })
          : null;

      return {
        title: t('Regressed'),
        details: data.version ? (
          <Fragment>
            {tct('in [version]', {
              version: (
                <ActivityRelease
                  organization={organization}
                  project={project}
                  version={data.version}
                />
              ),
            })}
            {comparison}
          </Fragment>
        ) : undefined,
      };
    }
    case GroupActivityType.CREATE_ISSUE:
      return {
        title:
          activity.data.new === false
            ? t('Linked %s issue', activity.data.provider)
            : t('Created %s issue', activity.data.provider),
        details: (
          <ExternalIssueChip
            label={activity.data.label ?? activity.data.title}
            location={activity.data.location}
            provider={activity.data.provider}
          />
        ),
      };
    case GroupActivityType.MERGE:
      return {
        title: t('Merged'),
        details: tn('%s other issue', '%s other issues', activity.data.issues.length),
      };
    case GroupActivityType.UNMERGE_SOURCE:
      return {
        title: t('Unmerged'),
        details: tn(
          '%1$s fingerprint to %2$s',
          '%1$s fingerprints to %2$s',
          activity.data.fingerprints.length,
          activity.data.destination ? (
            <Link
              to={`${issuesLink}${activity.data.destination.id}?referrer=group-activity-unmerged-source`}
            >
              {activity.data.destination.shortId}
            </Link>
          ) : (
            t('a group')
          )
        ),
      };
    case GroupActivityType.UNMERGE_DESTINATION:
      return {
        title: t('Unmerged'),
        details: tn(
          '%1$s fingerprint from %2$s',
          '%1$s fingerprints from %2$s',
          activity.data.fingerprints.length,
          activity.data.source ? (
            <Link
              to={`${issuesLink}${activity.data.source.id}?referrer=group-activity-unmerged-destination`}
            >
              {activity.data.source.shortId}
            </Link>
          ) : (
            t('a group')
          )
        ),
      };
    case GroupActivityType.FIRST_SEEN:
      return {
        title: t('First seen'),
        details: activity.data.priority
          ? tct('with [priority] priority', {
              priority: <ActivityPriorityChip priority={activity.data.priority} />,
            })
          : null,
      };
    case GroupActivityType.ASSIGNED:
      return getAssignedActivityItem({activity});
    case GroupActivityType.UNASSIGNED:
      return {
        title: t('Unassigned'),
      };
    case GroupActivityType.REPROCESS:
      return {
        title: t('Reprocessed'),
        details: tct('into [events]', {
          events: (
            <Link
              to={`/organizations/${organization.slug}/issues/?query=reprocessing.original_issue_id:${activity.data.oldGroupId}&referrer=group-activity-reprocesses`}
            >
              {tn('%s new event', '%s new events', activity.data.eventCount)}
            </Link>
          ),
        }),
      };
    case GroupActivityType.MARK_REVIEWED:
      return {
        title: t('Reviewed'),
      };
    case GroupActivityType.AUTO_SET_ONGOING:
      return {
        title: t('Became ongoing'),
        details: activity.data.after_days
          ? tct('after [days] days', {days: activity.data.after_days})
          : null,
      };
    case GroupActivityType.SET_ESCALATING:
      return {
        title: t('Escalated'),
        details: getEscalatingDetails(activity.data),
      };
    case GroupActivityType.SET_PRIORITY:
      return {
        title: t('Priority set'),
        details: getPriorityDetails(activity.data),
      };
    case GroupActivityType.DELETED_ATTACHMENT:
      return {
        title: t('Deleted an attachment'),
      };
    case GroupActivityType.SEER_RCA_STARTED:
      return {
        title: t('Root cause analysis started'),
      };
    case GroupActivityType.SEER_RCA_COMPLETED:
      return {
        title: t('Root cause found'),
      };
    case GroupActivityType.SEER_SOLUTION_STARTED:
      return {
        title: t('Plan started'),
      };
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
      return {
        title: t('Plan created'),
      };
    case GroupActivityType.SEER_CODING_STARTED:
      return {
        title: t('Code changes started'),
      };
    case GroupActivityType.SEER_CODING_COMPLETED:
      return {
        title: t('Code changes suggested'),
      };
    case GroupActivityType.SEER_PR_CREATED: {
      const pullRequest = activity.data.pull_requests?.[0];
      return {
        title: pullRequest
          ? tct('Pull request [pullRequest] created', {
              pullRequest: <SeerPullRequestChip pullRequest={pullRequest} />,
            })
          : t('Pull request created'),
        details: pullRequest
          ? tct('on [provider]', {
              provider: getProviderName(pullRequest.provider),
            })
          : null,
      };
    }
    case GroupActivityType.SEER_ITERATION_STARTED:
      return {
        title: t('Pull request iteration started'),
      };
    case GroupActivityType.SEER_ITERATION_COMPLETED: {
      const pullRequest = activity.data.pull_requests?.[0];
      return {
        title: pullRequest
          ? tct('Pull request [pullRequest] updated', {
              pullRequest: <SeerPullRequestChip pullRequest={pullRequest} />,
            })
          : t('Pull request updated'),
        details: pullRequest
          ? tct('on [provider]', {
              provider: getProviderName(pullRequest.provider),
            })
          : null,
      };
    }
  }

  Sentry.captureMessage(`Unknown group activity type: ${activityContext.type}`, {
    contexts: {activity: activityContext},
  });

  return {
    title: t('Activity'),
  };
}
