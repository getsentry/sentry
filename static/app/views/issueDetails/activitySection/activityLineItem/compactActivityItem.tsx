import {Fragment} from 'react';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {CommitLink} from 'sentry/components/commitLink';
import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {t, tct, tn} from 'sentry/locale';
import type {
  GroupActivity,
  GroupActivityAssigned,
  GroupActivitySetEscalating,
  GroupActivitySetIgnored,
  IssueCategory,
} from 'sentry/types/group';
import {GroupActivityType, IssueCategory as IssueCategoryEnum} from 'sentry/types/group';
import type {Commit, PullRequest} from 'sentry/types/integrations';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import {formatDuration} from 'sentry/utils/duration/formatDuration';
import {isSemverRelease} from 'sentry/utils/versions/isSemverRelease';

import {
  ActivityPriorityChip,
  ActivityRelease,
  AssigneePill,
  PullRequestChip,
  SeerPullRequestChip,
} from './badges';

export interface CompactGroupActivityItem {
  title: React.ReactNode;
  body?: string;
  details?: React.ReactNode;
  subtext?: React.ReactNode;
}

function getAuthorName(item: GroupActivity) {
  if (item.sentry_app) {
    return item.sentry_app.name;
  }
  if (item.user) {
    return item.user.name;
  }
  if (
    item.type === GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST &&
    item.data.pullRequest?.author?.name &&
    !item.data.pullRequest.author.email?.endsWith('@localhost')
  ) {
    return item.data.pullRequest.author.name;
  }
  return 'Sentry';
}

function getProviderName(provider: null | string | undefined) {
  const normalized = provider?.toLowerCase();

  if (!normalized) {
    return t('Git provider');
  }
  if (normalized.includes('github')) {
    return t('GitHub');
  }
  if (normalized.includes('gitlab')) {
    return t('GitLab');
  }
  if (normalized.includes('bitbucket')) {
    return t('Bitbucket');
  }
  return provider;
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
  const integrationData = data as {
    integration_id?: unknown;
    provider?: unknown;
    provider_key?: unknown;
  };
  const integrationId = integrationData.integration_id;
  const providerKey = integrationData.provider_key;
  const provider = integrationData.provider;

  if (!integrationId || typeof providerKey !== 'string' || typeof provider !== 'string') {
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

function renderCommitLink(commit: Commit) {
  return <CommitLink inline commitId={commit.id} repository={commit.repository} />;
}

function getResolvedInCommitDetails(
  activity: Extract<GroupActivity, {type: GroupActivityType.SET_RESOLVED_IN_COMMIT}>,
  organization: Organization,
  project: Project
) {
  const commit = activity.data.commit;
  if (!commit) {
    return t('in a commit');
  }

  const deployedReleases = (commit.releases || [])
    .filter(release => release.dateReleased !== null)
    .sort((a, b) => moment(a.dateReleased).valueOf() - moment(b.dateReleased).valueOf());

  if (deployedReleases.length === 1) {
    return tct('in [commit], released in [release]', {
      commit: renderCommitLink(commit),
      release: (
        <ActivityRelease
          organization={organization}
          project={project}
          version={deployedReleases[0]!.version}
        />
      ),
    });
  }

  if (deployedReleases.length > 1) {
    return tct('in [commit], released in [release] and [otherCount] others', {
      commit: renderCommitLink(commit),
      otherCount: deployedReleases.length - 1,
      release: (
        <ActivityRelease
          organization={organization}
          project={project}
          version={deployedReleases[0]!.version}
        />
      ),
    });
  }

  return tct('in [commit]', {
    commit: renderCommitLink(commit),
  });
}

function isTeam(value: Team | User): value is Team {
  return 'slug' in value;
}

function getAssignedAssignee(activity: GroupActivityAssigned, teams: Team[]) {
  const {data} = activity;

  if (data.assigneeType === 'team') {
    return teams.find(({id}) => id === data.assignee) ?? '<unknown-team>';
  }

  if (data.assignee === activity.user?.id) {
    return t('themselves');
  }

  if (data.user && !isTeam(data.user)) {
    return data.user;
  }

  if (data.assigneeType === 'user' && data.assigneeEmail) {
    return data.assigneeEmail;
  }

  return t('an unknown user');
}

function AssignmentLead({children}: {children: React.ReactNode}) {
  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      wrap="wrap"
      gap="xs"
      maxWidth="100%"
      minWidth={0}
    >
      {children}
    </Flex>
  );
}

function AssignmentPrefix({children}: {children: React.ReactNode}) {
  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      gap="xs"
      maxWidth="100%"
      minWidth={0}
      whiteSpace="nowrap"
    >
      {children}
    </Flex>
  );
}

function AssignmentTitleText({children}: {children: React.ReactNode}) {
  return (
    <Text as="span" bold density="comfortable">
      {children}
    </Text>
  );
}

function AssignmentDetailText({children}: {children: React.ReactNode}) {
  return (
    <Text as="span" variant="muted" bold={false} density="comfortable">
      {children}
    </Text>
  );
}

function RuleSource({children}: {children: React.ReactNode}) {
  return (
    <Text as="span" variant="muted" bold={false} density="comfortable" wrap="nowrap">
      {children}
    </Text>
  );
}

function RuleText({children}: {children: React.ReactNode}) {
  return (
    <Text
      as="span"
      variant="muted"
      size="sm"
      monospace
      bold={false}
      density="comfortable"
      wordBreak="break-all"
    >
      {children}
    </Text>
  );
}

function getAssignedItem(activity: GroupActivityAssigned, teams: Team[]) {
  const {data} = activity;
  const assignedToSelf = data.assignee === activity.user?.id;
  const assignee = assignedToSelf ? (
    t('themselves')
  ) : (
    <AssigneePill assignee={getAssignedAssignee(activity, teams)} />
  );
  const integrationName: Record<
    NonNullable<GroupActivityAssigned['data']['integration']>,
    string
  > = {
    msteams: t('Microsoft Teams'),
    slack: t('Slack'),
    projectOwnership: t('Ownership Rule'),
    codeowners: t('Codeowners Rule'),
    suspectCommitter: t('Suspect Commit'),
  };

  if (data.integration && integrationName[data.integration]) {
    return {
      title: (
        <AssignmentLead>
          <AssignmentPrefix>
            <AssignmentTitleText>{t('Assigned')}</AssignmentTitleText>
            <AssignmentDetailText>
              {tct('to [assignee] due to', {assignee})}
            </AssignmentDetailText>
          </AssignmentPrefix>
          <RuleSource>{integrationName[data.integration]}</RuleSource>
        </AssignmentLead>
      ),
      subtext: data.rule ? <RuleText>{data.rule}</RuleText> : null,
    };
  }

  return {
    title: (
      <AssignmentLead>
        <AssignmentPrefix>
          <AssignmentTitleText>{t('Assigned')}</AssignmentTitleText>
          <AssignmentDetailText>
            {assignedToSelf
              ? tct('to [assignee]', {assignee})
              : tct('to [assignee] by', {assignee})}
          </AssignmentDetailText>
        </AssignmentPrefix>
        {assignedToSelf ? null : getAuthorName(activity)}
      </AssignmentLead>
    ),
  };
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

export function getCompactGroupActivityItem(
  activity: GroupActivity,
  organization: Organization,
  project: Project,
  issueCategory: IssueCategory,
  teams: Team[]
): CompactGroupActivityItem {
  const author = getAuthorName(activity);
  const issuesLink = `/organizations/${organization.slug}/issues/`;

  switch (activity.type) {
    case GroupActivityType.NOTE:
      return {
        title: author,
        body: activity.data.text,
      };
    case GroupActivityType.SET_RESOLVED: {
      const integrationLink = getIntegrationLink({data: activity.data, organization});
      return {
        title: t('Issue resolved'),
        details: integrationLink
          ? tct('by [author] via [integration]', {
              author,
              integration: integrationLink,
            })
          : tct('by [author]', {author}),
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
          ? tct('by [author] in [commit]', {
              author,
              commit: renderCommitLink(activity.data.commit),
            })
          : tct('by [author] in a commit', {author}),
      };
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST: {
      const pullRequest = activity.data.pullRequest;
      return {
        title: t('Pull Request created'),
        details: pullRequest
          ? tct('on [provider] [pullRequest]', {
              provider: getPullRequestProvider(pullRequest),
              pullRequest: <PullRequestChip pullRequest={pullRequest} />,
            })
          : t('in a pull request'),
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
        title: t('Issue ongoing'),
        details: integrationLink
          ? tct('by [author] via [integration]', {
              author,
              integration: integrationLink,
            })
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
        title: t('Made public'),
        details: tct('by [author]', {author}),
      };
    case GroupActivityType.SET_PRIVATE:
      return {
        title: t('Made private'),
        details: tct('by [author]', {author}),
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
            {comparison && <Fragment> {comparison}</Fragment>}
          </Fragment>
        ) : (
          tct('by [author]', {author})
        ),
      };
    }
    case GroupActivityType.CREATE_ISSUE:
      return {
        title: activity.data.new === false ? t('Linked Issue') : t('Created Issue'),
        details: tct('on [provider] [title]', {
          provider: activity.data.provider,
          title: (
            <ExternalLink href={activity.data.location}>
              {activity.data.title}
            </ExternalLink>
          ),
        }),
      };
    case GroupActivityType.MERGE:
      return {
        title: t('Merged'),
        details: tn(
          '%1$s issue into this issue by %2$s',
          '%1$s issues into this issue by %2$s',
          activity.data.issues.length,
          author
        ),
      };
    case GroupActivityType.UNMERGE_SOURCE:
      return {
        title: t('Unmerged'),
        details: tn(
          '%1$s fingerprint to %3$s by %2$s',
          '%1$s fingerprints to %3$s by %2$s',
          activity.data.fingerprints.length,
          author,
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
          '%1$s fingerprint from %3$s by %2$s',
          '%1$s fingerprints from %3$s by %2$s',
          activity.data.fingerprints.length,
          author,
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
      return {
        ...getAssignedItem(activity, teams),
      };
    case GroupActivityType.UNASSIGNED:
      return {
        title: t('Unassigned'),
        details: tct('by [author]', {author}),
      };
    case GroupActivityType.REPROCESS:
      return {
        title: t('Reprocessed events'),
        details: tct('by [author]. [newEvents]', {
          author,
          newEvents: (
            <Link
              to={`/organizations/${organization.slug}/issues/?query=reprocessing.original_issue_id:${activity.data.oldGroupId}&referrer=group-activity-reprocesses`}
            >
              {tn('See %s new event', 'See %s new events', activity.data.eventCount)}
            </Link>
          ),
        }),
      };
    case GroupActivityType.MARK_REVIEWED:
      return {
        title: t('Issue reviewed'),
        details: tct('by [author]', {author}),
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
        details: tct('by [author]', {author}),
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
        title: t('Pull Request created'),
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
        title: t('PR iteration started'),
      };
    case GroupActivityType.SEER_ITERATION_COMPLETED: {
      const pullRequest = activity.data.pull_requests?.[0];
      return {
        title: t('Pull Request updated'),
        details: pullRequest
          ? tct('on [provider] [pullRequest]', {
              provider: getProviderName(pullRequest.provider),
              pullRequest: <SeerPullRequestChip pullRequest={pullRequest} />,
            })
          : null,
      };
    }
  }
}
