import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import CommitLink from 'sentry/components/commitLink';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import PullRequestLink from 'sentry/components/pullRequestLink';
import Version from 'sentry/components/version';
import {t, tct, tn} from 'sentry/locale';
import {
  GroupActivity,
  GroupActivityAssigned,
  GroupActivitySetEscalating,
  GroupActivitySetIgnored,
  GroupActivityType,
  Organization,
  Project,
  User,
} from 'sentry/types';
import {isSemverRelease} from 'sentry/utils/formatters';
import {useTeamsById} from 'sentry/utils/useTeamsById';

interface AssignedMessageProps {
  activity: GroupActivityAssigned;
  author: React.ReactNode;
}

function AssignedMessage({activity, author}: AssignedMessageProps) {
  const {data} = activity;
  let assignee: string | User | undefined = undefined;
  const {teams} = useTeamsById(
    data.assigneeType === 'team' ? {ids: [data.assignee]} : undefined
  );

  if (data.assigneeType === 'team') {
    const team = teams.find(({id}) => id === data.assignee);
    // TODO: could show a loading indicator if the team is loading
    assignee = team ? `#${team.slug}` : '<unknown-team>';
  } else if (activity.user && data.assignee === activity.user.id) {
    assignee = t('themselves');
  } else if (data.assigneeType === 'user' && data.assigneeEmail) {
    assignee = data.assigneeEmail;
  } else {
    assignee = t('an unknown user');
  }

  const isAutoAssigned = ['projectOwnership', 'codeowners'].includes(
    data.integration as string
  );

  const integrationName: Record<
    NonNullable<GroupActivityAssigned['data']['integration']>,
    string
  > = {
    msteams: t('Microsoft Teams'),
    slack: t('Slack'),
    projectOwnership: t('Ownership Rule'),
    codeowners: t('Codeowners Rule'),
  };

  return (
    <Fragment>
      <div>
        {tct('[author] [action] this issue to [assignee]', {
          action: isAutoAssigned ? t('auto-assigned') : t('assigned'),
          author,
          assignee,
        })}
      </div>
      {data.integration && (
        <CodeWrapper>
          {t('Assigned via %s', integrationName[data.integration])}
          {data.rule && (
            <Fragment>
              : <StyledRuleSpan>{data.rule}</StyledRuleSpan>
            </Fragment>
          )}
        </CodeWrapper>
      )}
    </Fragment>
  );
}

interface GroupActivityItemProps {
  activity: GroupActivity;
  author: React.ReactNode;
  organization: Organization;
  projectId: Project['id'];
}

function GroupActivityItem({
  activity,
  organization,
  projectId,
  author,
}: GroupActivityItemProps) {
  const issuesLink = `/organizations/${organization.slug}/issues/`;
  const hasEscalatingIssuesUi = organization.features.includes('escalating-issues');

  function getIgnoredMessage(data: GroupActivitySetIgnored['data']) {
    const ignoredOrArchived = hasEscalatingIssuesUi ? t('archived') : t('ignored');
    if (data.ignoreDuration) {
      return tct('[author] [action] this issue for [duration]', {
        author,
        action: ignoredOrArchived,
        duration: <Duration seconds={data.ignoreDuration * 60} />,
      });
    }

    if (data.ignoreCount && data.ignoreWindow) {
      return tct(
        '[author] [action] this issue until it happens [count] time(s) in [duration]',
        {
          author,
          action: ignoredOrArchived,
          count: data.ignoreCount,
          duration: <Duration seconds={data.ignoreWindow * 60} />,
        }
      );
    }

    if (data.ignoreCount) {
      return tct('[author] [action] this issue until it happens [count] time(s)', {
        author,
        action: ignoredOrArchived,
        count: data.ignoreCount,
      });
    }

    if (data.ignoreUserCount && data.ignoreUserWindow) {
      return tct(
        '[author] [action] this issue until it affects [count] user(s) in [duration]',
        {
          author,
          action: ignoredOrArchived,
          count: data.ignoreUserCount,
          duration: <Duration seconds={data.ignoreUserWindow * 60} />,
        }
      );
    }

    if (data.ignoreUserCount) {
      return tct('[author] [action] this issue until it affects [count] user(s)', {
        author,
        action: ignoredOrArchived,
        count: data.ignoreUserCount,
      });
    }

    if (data.ignoreUntil) {
      return tct('[author] [action] this issue until [date]', {
        author,
        action: ignoredOrArchived,
        date: <DateTime date={data.ignoreUntil} />,
      });
    }
    if (hasEscalatingIssuesUi && data.ignoreUntilEscalating) {
      return tct('[author] archived this issue until it escalates', {
        author,
      });
    }

    return tct('[author] [action] this issue forever', {
      author,
      action: ignoredOrArchived,
    });
  }

  function getEscalatingMessage(data: GroupActivitySetEscalating['data']) {
    if (data.forecast) {
      return tct(
        '[author] flagged this issue as escalating because over [forecast] [event] happened in an hour',
        {
          author,
          forecast: data.forecast,
          event: data.forecast === 1 ? 'event' : 'events',
        }
      );
    }

    if (data.expired_snooze) {
      if (data.expired_snooze.count && data.expired_snooze.window) {
        return tct(
          '[author] flagged this issue as escalating because [count] [event] happened in [duration]',
          {
            author,
            count: data.expired_snooze.count,
            event: data.expired_snooze.count === 1 ? 'event' : 'events',
            duration: <Duration seconds={data.expired_snooze.window * 60} />,
          }
        );
      }

      if (data.expired_snooze.count) {
        return tct(
          '[author] flagged this issue as escalating because [count] [event] happened',
          {
            author,
            count: data.expired_snooze.count,
            event: data.expired_snooze.count === 1 ? 'event' : 'events',
          }
        );
      }

      if (data.expired_snooze.user_count && data.expired_snooze.user_window) {
        return tct(
          '[author] flagged this issue as escalating because [count] [user] affected in [duration]',
          {
            author,
            count: data.expired_snooze.user_count,
            user: data.expired_snooze.user_count === 1 ? 'user was' : 'users were',
            duration: <Duration seconds={data.expired_snooze.user_window * 60} />,
          }
        );
      }

      if (data.expired_snooze.user_count) {
        return tct(
          '[author] flagged this issue as escalating because [count] [user] affected',
          {
            author,
            count: data.expired_snooze.user_count,
            user: data.expired_snooze.user_count === 1 ? 'user was' : 'users were',
          }
        );
      }

      if (data.expired_snooze.until) {
        return tct('[author] flagged this issue as escalating because [date] passed', {
          author,
          date: <DateTime date={data.expired_snooze.until} />,
        });
      }
    }

    return tct('[author] flagged this issue as escalating', {author}); // should not reach this
  }

  function renderContent() {
    switch (activity.type) {
      case GroupActivityType.NOTE:
        return tct('[author] left a comment', {author});
      case GroupActivityType.SET_RESOLVED:
        return tct('[author] marked this issue as resolved', {author});
      case GroupActivityType.SET_RESOLVED_BY_AGE:
        return tct('[author] marked this issue as resolved due to inactivity', {
          author,
        });
      case GroupActivityType.SET_RESOLVED_IN_RELEASE:
        // Resolved in the next release
        if ('current_release_version' in activity.data) {
          const currentVersion = activity.data.current_release_version;
          return tct(
            '[author] marked this issue as resolved in releases greater than [version] [semver]',
            {
              author,
              version: (
                <Version
                  version={currentVersion}
                  projectId={projectId}
                  tooltipRawVersion
                />
              ),
              semver: isSemverRelease(currentVersion) ? t('(semver)') : t('(non-semver)'),
            }
          );
        }

        const version = activity.data.version;
        return version
          ? tct('[author] marked this issue as resolved in [version] [semver]', {
              author,
              version: (
                <Version version={version} projectId={projectId} tooltipRawVersion />
              ),
              semver: isSemverRelease(version) ? t('(semver)') : t('(non-semver)'),
            })
          : tct('[author] marked this issue as resolved in the upcoming release', {
              author,
            });
      case GroupActivityType.SET_RESOLVED_IN_COMMIT:
        const deployedReleases = (activity.data.commit?.releases || [])
          .filter(r => r.dateReleased !== null)
          .sort(
            (a, b) => moment(a.dateReleased).valueOf() - moment(b.dateReleased).valueOf()
          );
        if (deployedReleases.length === 1 && activity.data.commit) {
          return tct(
            '[author] marked this issue as resolved in [version] [break]This commit was released in [release]',
            {
              author,
              version: (
                <CommitLink
                  inline
                  commitId={activity.data.commit.id}
                  repository={activity.data.commit.repository}
                />
              ),
              break: <br />,
              release: (
                <Version
                  version={deployedReleases[0].version}
                  projectId={projectId}
                  tooltipRawVersion
                />
              ),
            }
          );
        }
        if (deployedReleases.length > 1 && activity.data.commit) {
          return tct(
            '[author] marked this issue as resolved in [version] [break]This commit was released in [release] and [otherCount] others',
            {
              author,
              otherCount: deployedReleases.length - 1,
              version: (
                <CommitLink
                  inline
                  commitId={activity.data.commit.id}
                  repository={activity.data.commit.repository}
                />
              ),
              break: <br />,
              release: (
                <Version
                  version={deployedReleases[0].version}
                  projectId={projectId}
                  tooltipRawVersion
                />
              ),
            }
          );
        }
        if (activity.data.commit) {
          return tct('[author] marked this issue as resolved in [commit]', {
            author,
            commit: (
              <CommitLink
                inline
                commitId={activity.data.commit.id}
                repository={activity.data.commit.repository}
              />
            ),
          });
        }
        return tct('[author] marked this issue as resolved in a commit', {author});
      case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST: {
        const {data} = activity;
        const {pullRequest} = data;
        return tct('[author] has created a PR for this issue: [pullRequest]', {
          author,
          pullRequest: pullRequest ? (
            <PullRequestLink
              inline
              pullRequest={pullRequest}
              repository={pullRequest.repository}
            />
          ) : (
            t('PR not available')
          ),
        });
      }
      case GroupActivityType.SET_UNRESOLVED: {
        // TODO(nisanthan): Remove after migrating records to SET_ESCALATING
        const {data} = activity;
        if (data.forecast) {
          return tct(
            '[author] flagged this issue as escalating because over [forecast] [event] happened in an hour',
            {
              author,
              forecast: data.forecast,
              event: data.forecast === 1 ? 'event' : 'events',
            }
          );
        }
        return tct('[author] marked this issue as unresolved', {author});
      }
      case GroupActivityType.SET_IGNORED: {
        const {data} = activity;
        return getIgnoredMessage(data);
      }
      case GroupActivityType.SET_PUBLIC:
        return tct('[author] made this issue public', {author});
      case GroupActivityType.SET_PRIVATE:
        return tct('[author] made this issue private', {author});
      case GroupActivityType.SET_REGRESSION: {
        const {data} = activity;
        let subtext: React.ReactNode = null;
        if (data.version && data.resolved_in_version && 'follows_semver' in data) {
          subtext = (
            <Subtext>
              {tct(
                '[regressionVersion] is greater than or equal to [resolvedVersion] compared via [comparison]',
                {
                  regressionVersion: (
                    <Version
                      version={data.version}
                      projectId={projectId}
                      tooltipRawVersion
                    />
                  ),
                  resolvedVersion: (
                    <Version
                      version={data.resolved_in_version}
                      projectId={projectId}
                      tooltipRawVersion
                    />
                  ),
                  comparison: data.follows_semver ? t('semver') : t('release date'),
                }
              )}
            </Subtext>
          );
        }

        return data.version ? (
          <Fragment>
            {tct('[author] marked this issue as a regression in [version]', {
              author,
              version: (
                <Version version={data.version} projectId={projectId} tooltipRawVersion />
              ),
            })}
            {subtext}
          </Fragment>
        ) : (
          <Fragment>
            {tct('[author] marked this issue as a regression', {
              author,
            })}
            {subtext}
          </Fragment>
        );
      }
      case GroupActivityType.CREATE_ISSUE: {
        const {data} = activity;
        return tct('[author] created an issue on [provider] titled [title]', {
          author,
          provider: data.provider,
          title: <ExternalLink href={data.location}>{data.title}</ExternalLink>,
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
            <Link
              to={`${issuesLink}${destination.id}?referrer=group-activity-unmerged-source`}
            >
              {destination.shortId}
            </Link>
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
            <Link
              to={`${issuesLink}${source.id}?referrer=group-activity-unmerged-destination`}
            >
              {source.shortId}
            </Link>
          ) : (
            t('a group')
          )
        );
      }
      case GroupActivityType.FIRST_SEEN:
        return tct('[author] first saw this issue', {author});
      case GroupActivityType.ASSIGNED: {
        return <AssignedMessage activity={activity} author={author} />;
      }
      case GroupActivityType.UNASSIGNED:
        return tct('[author] unassigned this issue', {author});
      case GroupActivityType.MERGE:
        return tn(
          '%2$s merged %1$s issue into this issue',
          '%2$s merged %1$s issues into this issue',
          activity.data.issues.length,
          author
        );
      case GroupActivityType.REPROCESS: {
        const {data} = activity;
        const {oldGroupId, eventCount} = data;

        return tct('[author] reprocessed the events in this issue. [new-events]', {
          author,
          ['new-events']: (
            <Link
              to={`/organizations/${organization.slug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}&referrer=group-activity-reprocesses`}
            >
              {tn('See %s new event', 'See %s new events', eventCount)}
            </Link>
          ),
        });
      }
      case GroupActivityType.MARK_REVIEWED: {
        return tct('[author] marked this issue as reviewed', {
          author,
        });
      }
      case GroupActivityType.AUTO_SET_ONGOING: {
        return activity.data?.afterDays
          ? tct(
              '[author] automatically marked this issue as ongoing after [afterDays] days',
              {author, afterDays: activity.data.afterDays}
            )
          : tct('[author] automatically marked this issue as ongoing', {
              author,
            });
      }
      case GroupActivityType.SET_ESCALATING: {
        return getEscalatingMessage(activity.data);
      }

      default:
        return ''; // should never hit (?)
    }
  }

  return <Fragment>{renderContent()}</Fragment>;
}

export default GroupActivityItem;

const Subtext = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const CodeWrapper = styled('div')`
  overflow-wrap: anywhere;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledRuleSpan = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;
