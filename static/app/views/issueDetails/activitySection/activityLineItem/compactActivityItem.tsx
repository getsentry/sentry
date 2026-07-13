import {Fragment} from 'react';

import {Link} from '@sentry/scraps/link';

import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {t, tct, tn} from 'sentry/locale';
import type {
  GroupActivity,
  GroupActivitySetEscalating,
  GroupActivitySetIgnored,
  IssueCategory,
} from 'sentry/types/group';
import {GroupActivityType, IssueCategory as IssueCategoryEnum} from 'sentry/types/group';
import type {PullRequest} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatDuration} from 'sentry/utils/duration/formatDuration';
import {isSemverRelease} from 'sentry/utils/versions/isSemverRelease';

import {CommitChip} from './chips/commitChip';
import {ExternalIssueChip} from './chips/externalIssueChip';
import {ActivityPriorityChip} from './chips/priorityChip';
import {PullRequestChip, SeerPullRequestChip} from './chips/pullRequestChip';
import {ActivityRelease} from './chips/releaseChip';
import {getAssignedActivityItem} from './compactActivityItem/assignment';
import {getResolvedInCommitDetails} from './compactActivityItem/commitDetails';
import {getProviderName} from './compactActivityItem/provider';
import type {CompactGroupActivityItem} from './compactActivityItem/types';

export type {CompactGroupActivityItem} from './compactActivityItem/types';

function getAuthorName(item: GroupActivity) {
  if (item.sentry_app) {
    return item.sentry_app.name;
  }
  if (item.user) {
    return item.user.name;
  }
  if (
    (item.type === GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST ||
      item.type === GroupActivityType.PULL_REQUEST_CLOSED) &&
    item.data.pullRequest?.author?.name &&
    !item.data.pullRequest.author.email?.endsWith('@localhost')
  ) {
    return item.data.pullRequest.author.name;
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

function getIntegrationLink({
  data,
  organization,
}: {
  data: Record<PropertyKey, unknown>;
  organization: Organization;
}) {
  const integrationId = data.integration_id;
  const providerKey = data.provider_key;
  const provider = data.provider;

  if (
    (typeof integrationId !== 'string' && typeof integrationId !== 'number') ||
    typeof providerKey !== 'string' ||
    typeof provider !== 'string'
  ) {
    return null;
  }

  return (
    <Link
      to={`/settings/${organization.slug}/integrations/${providerKey}/${integrationId}/`}
    >
      {provider}
    </Link>
  );
}

function getIgnoredDetails(
  data: GroupActivitySetIgnored['data'],
  issueCategory: IssueCategory
) {
  const isFeedback = issueCategory === IssueCategoryEnum.FEEDBACK;

  if (data.ignoreDuration) {
    return tct('for [duration]', {
      duration: <Duration seconds={data.ignoreDuration * 60} />,
    });
  }

  if (data.ignoreCount && data.ignoreWindow) {
    return tct('until it happens [count] time(s) in [duration]', {
      count: data.ignoreCount,
      duration: <Duration seconds={data.ignoreWindow * 60} />,
    });
  }

  if (data.ignoreCount) {
    return tct('until it happens [count] time(s)', {
      count: data.ignoreCount,
    });
  }

  if (data.ignoreUserCount && data.ignoreUserWindow) {
    return tct('until it affects [count] user(s) in [duration]', {
      count: data.ignoreUserCount,
      duration: <Duration seconds={data.ignoreUserWindow * 60} />,
    });
  }

  if (data.ignoreUserCount) {
    return tct('until it affects [count] user(s)', {
      count: data.ignoreUserCount,
    });
  }

  if (data.ignoreUntil) {
    return tct('until [date]', {
      date: <DateTime date={data.ignoreUntil} />,
    });
  }

  if (data.ignoreUntilEscalating) {
    return t('until it escalates');
  }

  return isFeedback ? null : t('forever');
}

function getEscalatingDetails(data: GroupActivitySetEscalating['data']) {
  if (data.forecast) {
    return tct('because over [forecast] [event] happened in an hour', {
      forecast: data.forecast,
      event: data.forecast === 1 ? t('event') : t('events'),
    });
  }

  if (data.expired_snooze?.count && data.expired_snooze.window) {
    return tct('because [count] [event] happened in [duration]', {
      count: data.expired_snooze.count,
      event: data.expired_snooze.count === 1 ? t('event') : t('events'),
      duration: <Duration seconds={data.expired_snooze.window * 60} />,
    });
  }

  if (data.expired_snooze?.count) {
    return tct('because [count] [event] happened', {
      count: data.expired_snooze.count,
      event: data.expired_snooze.count === 1 ? t('event') : t('events'),
    });
  }

  if (data.expired_snooze?.user_count && data.expired_snooze.user_window) {
    return tct('because [count] [user] affected in [duration]', {
      count: data.expired_snooze.user_count,
      user: data.expired_snooze.user_count === 1 ? t('user was') : t('users were'),
      duration: <Duration seconds={data.expired_snooze.user_window * 60} />,
    });
  }

  if (data.expired_snooze?.user_count) {
    return tct('because [count] [user] affected', {
      count: data.expired_snooze.user_count,
      user: data.expired_snooze.user_count === 1 ? t('user was') : t('users were'),
    });
  }

  if (data.expired_snooze?.until) {
    return tct('because [date] passed', {
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
      return tct('to [priority] after it escalated', {priority});
    case 'ongoing':
      return tct('to [priority] after it was marked as ongoing', {priority});
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
  const author = getAuthorName(activity);
  const issuesLink = `/organizations/${organization.slug}/issues/`;

  switch (activity.type) {
    case GroupActivityType.NOTE:
      return {
        title: author,
      };
    case GroupActivityType.SET_RESOLVED: {
      const integrationLink = getIntegrationLink({data: activity.data, organization});
      return {
        title: t('Issue resolved'),
        details: integrationLink
          ? tct('via [integration]', {integration: integrationLink})
          : undefined,
      };
    }
    case GroupActivityType.SET_RESOLVED_BY_AGE: {
      const duration = formatAutoResolveAge(activity.data.age);
      return {
        title: t('Issue resolved'),
        details: duration
          ? tct('after [duration] of inactivity', {duration})
          : t('due to inactivity'),
      };
    }
    case GroupActivityType.SET_RESOLVED_IN_RELEASE: {
      const integrationLink = getIntegrationLink({data: activity.data, organization});
      const integrationDetails = integrationLink
        ? tct(' via [integration]', {integration: integrationLink})
        : null;

      if ('current_release_version' in activity.data) {
        const currentVersion = activity.data.current_release_version;
        return {
          title: t('Issue resolved'),
          details: (
            <Fragment>
              {tct('in releases greater than [version] [semver]', {
                version: (
                  <ActivityRelease
                    organization={organization}
                    project={project}
                    version={currentVersion}
                  />
                ),
                semver: isSemverRelease(currentVersion)
                  ? t('(semver)')
                  : t('(non-semver)'),
              })}
              {integrationDetails}
            </Fragment>
          ),
        };
      }

      if (activity.data.version) {
        return {
          title: t('Issue resolved'),
          details: (
            <Fragment>
              {tct('in [version] [semver]', {
                version: (
                  <ActivityRelease
                    organization={organization}
                    project={project}
                    version={activity.data.version}
                  />
                ),
                semver: isSemverRelease(activity.data.version)
                  ? t('(semver)')
                  : t('(non-semver)'),
              })}
              {integrationDetails}
            </Fragment>
          ),
        };
      }

      return {
        title: t('Issue resolved'),
        details: (
          <Fragment>
            {t('in the upcoming release')}
            {integrationDetails}
          </Fragment>
        ),
      };
    }
    case GroupActivityType.SET_RESOLVED_IN_COMMIT:
      return {
        title: t('Issue resolved'),
        details: getResolvedInCommitDetails(activity, organization, project),
      };
    case GroupActivityType.REFERENCED_IN_COMMIT:
      return {
        title: t('Referenced in commit'),
        details: activity.data.commit
          ? tct('on [provider] [commit]', {
              commit: <CommitChip commit={activity.data.commit} />,
              provider: getProviderName(
                activity.data.commit.repository?.provider?.name ??
                  activity.data.commit.repository?.provider?.id
              ),
            })
          : undefined,
      };
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: t('Pull request created'),
        details: pullRequest
          ? tct('on [provider] [pullRequest]', {
              provider: getPullRequestProvider(pullRequest),
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : null,
      };
    }
    case GroupActivityType.PULL_REQUEST_CLOSED: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: t('Pull request closed'),
        details: pullRequest
          ? tct('by [author] on [provider] [pullRequest]', {
              author,
              provider: getPullRequestProvider(pullRequest),
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : tct('by [author]', {author}),
      };
    }
    case GroupActivityType.SET_UNRESOLVED: {
      if ('forecast' in activity.data && activity.data.forecast) {
        return {
          title: t('Issue escalated'),
          details: tct('because over [forecast] [event] happened in an hour', {
            forecast: activity.data.forecast,
            event: activity.data.forecast === 1 ? t('event') : t('events'),
          }),
        };
      }

      const integrationLink = getIntegrationLink({data: activity.data, organization});
      return {
        title: t('Issue unresolved'),
        details: integrationLink
          ? tct('via [integration]', {integration: integrationLink})
          : null,
      };
    }
    case GroupActivityType.SET_IGNORED:
      return {
        title:
          issueCategory === IssueCategoryEnum.FEEDBACK
            ? t('Marked as spam')
            : t('Issue archived'),
        details: getIgnoredDetails(activity.data, issueCategory),
      };
    case GroupActivityType.SET_PUBLIC:
      return {
        title: t('Issue made public'),
      };
    case GroupActivityType.SET_PRIVATE:
      return {
        title: t('Issue made private'),
      };
    case GroupActivityType.SET_REGRESSION: {
      const {data} = activity;
      const comparison =
        data.version && data.resolved_in_version && 'follows_semver' in data
          ? tct('[regressionVersion] compared to [resolvedVersion] via [comparison]', {
              regressionVersion: (
                <ActivityRelease
                  organization={organization}
                  project={project}
                  version={data.version}
                />
              ),
              resolvedVersion: (
                <ActivityRelease
                  organization={organization}
                  project={project}
                  version={data.resolved_in_version}
                />
              ),
              comparison: data.follows_semver ? t('semver') : t('release date'),
            })
          : null;

      return {
        title: t('Issue regressed'),
        details: data.version
          ? tct('in [version]', {
              version: (
                <ActivityRelease
                  organization={organization}
                  project={project}
                  version={data.version}
                />
              ),
            })
          : undefined,
        subtext: comparison,
      };
    }
    case GroupActivityType.CREATE_ISSUE:
      return {
        title:
          activity.data.new === false
            ? t('External issue linked')
            : t('External issue created'),
        details: tct('on [provider] [title]', {
          provider: activity.data.provider,
          title: (
            <ExternalIssueChip
              label={activity.data.label ?? activity.data.title}
              location={activity.data.location}
              provider={activity.data.provider}
            />
          ),
        }),
      };
    case GroupActivityType.MERGE:
      return {
        title: t('Merged'),
        details: tn(
          '%s issue into this issue',
          '%s issues into this issue',
          activity.data.issues.length
        ),
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
        title: t('Issue first seen'),
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
        title: t('Issue unassigned'),
      };
    case GroupActivityType.REPROCESS:
      return {
        title: t('Events reprocessed'),
        details: (
          <Link
            to={`/organizations/${organization.slug}/issues/?query=reprocessing.original_issue_id:${activity.data.oldGroupId}&referrer=group-activity-reprocesses`}
          >
            {tn('See %s new event', 'See %s new events', activity.data.eventCount)}
          </Link>
        ),
      };
    case GroupActivityType.MARK_REVIEWED:
      return {
        title: t('Issue reviewed'),
      };
    case GroupActivityType.AUTO_SET_ONGOING:
      return {
        title: t('Issue ongoing'),
        details: activity.data.after_days
          ? tct('after [days] days', {days: activity.data.after_days})
          : null,
      };
    case GroupActivityType.SET_ESCALATING:
      return {
        title: t('Issue escalated'),
        details: getEscalatingDetails(activity.data),
      };
    case GroupActivityType.SET_PRIORITY:
      return {
        title: t('Priority set'),
        details: getPriorityDetails(activity.data),
      };
    case GroupActivityType.DELETED_ATTACHMENT:
      return {
        title: t('Attachment deleted'),
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
        title: t('Pull request created'),
        details: pullRequest
          ? tct('on [provider] [pullRequest]', {
              provider: getProviderName(pullRequest.provider),
              pullRequest: <SeerPullRequestChip pullRequest={pullRequest} />,
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
        title: t('Pull request updated'),
        details: pullRequest
          ? tct('on [provider] [pullRequest]', {
              provider: getProviderName(pullRequest.provider),
              pullRequest: <SeerPullRequestChip pullRequest={pullRequest} />,
            })
          : null,
      };
    }
  }

  return {
    title: t('Activity'),
  };
}
