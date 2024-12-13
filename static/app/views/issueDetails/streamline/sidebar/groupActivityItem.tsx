import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import CommitLink from 'sentry/components/commitLink';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import PullRequestLink from 'sentry/components/pullRequestLink';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t, tct, tn} from 'sentry/locale';
import type {
  GroupActivity,
  GroupActivityAssigned,
  GroupActivitySetEscalating,
  GroupActivitySetIgnored,
} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import useOrganization from 'sentry/utils/useOrganization';
import {isSemverRelease} from 'sentry/utils/versions/isSemverRelease';

export default function getGroupActivityItem(
  activity: GroupActivity,
  organization: Organization,
  project: Project,
  author: React.ReactNode,
  teams: Team[]
) {
  const issuesLink = `/organizations/${organization.slug}/issues/`;

  function getIgnoredMessage(data: GroupActivitySetIgnored['data']): {
    message: JSX.Element | string | null;
    title: JSX.Element | string;
  } {
    if (data.ignoreDuration) {
      return {
        title: t('Archived'),
        message: tct('by [author] for [duration]', {
          author,
          duration: <Duration seconds={data.ignoreDuration * 60} />,
        }),
      };
    }

    if (data.ignoreCount && data.ignoreWindow) {
      return {
        title: t('Archived'),
        message: tct('by [author] until it happens [count] time(s) in [duration]', {
          author,
          count: data.ignoreCount,
          duration: <Duration seconds={data.ignoreWindow * 60} />,
        }),
      };
    }

    if (data.ignoreCount) {
      return {
        title: t('Archived'),
        message: tct('by [author] until it happens [count] time(s)', {
          author,
          count: data.ignoreCount,
        }),
      };
    }

    if (data.ignoreUserCount && data.ignoreUserWindow) {
      return {
        title: t('Archived'),
        message: tct('by [author] until it affects [count] user(s) in [duration]', {
          author,
          count: data.ignoreUserCount,
          duration: <Duration seconds={data.ignoreUserWindow * 60} />,
        }),
      };
    }

    if (data.ignoreUserCount) {
      return {
        title: t('Archived'),
        message: tct('by [author] until it affects [count] user(s)', {
          author,
          count: data.ignoreUserCount,
        }),
      };
    }

    if (data.ignoreUntil) {
      return {
        title: t('Archived'),
        message: tct('by [author] until [date]', {
          author,
          date: <DateTime date={data.ignoreUntil} />,
        }),
      };
    }
    if (data.ignoreUntilEscalating) {
      return {
        title: t('Archived'),
        message: tct('by [author] until it escalates', {
          author,
        }),
      };
    }

    return {
      title: t('Archived'),
      message: tct('by [author] forever', {
        author,
      }),
    };
  }

  function getAssignedMessage(assignedActivity: GroupActivityAssigned) {
    const {data} = assignedActivity;
    let assignee: string | User | undefined = undefined;

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

    const isAutoAssigned = [
      'projectOwnership',
      'codeowners',
      'suspectCommitter',
    ].includes(data.integration as string);

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

    return {
      title: isAutoAssigned ? t('Auto-Assigned') : t('Assigned'),
      message: tct('by [author] to [assignee]. [assignedReason]', {
        author,
        assignee,
        assignedReason: data.integration && integrationName[data.integration] && (
          <CodeWrapper>
            {t('Assigned via %s', integrationName[data.integration])}
            {data.rule && (
              <Fragment>
                : <StyledRuleSpan>{data.rule}</StyledRuleSpan>
              </Fragment>
            )}
          </CodeWrapper>
        ),
      }),
    };
  }

  function getEscalatingMessage(data: GroupActivitySetEscalating['data']): {
    message: JSX.Element | string | null;
    title: JSX.Element | string;
  } {
    if (data.forecast) {
      return {
        title: t('Escalated'),
        message: tct('by [author] because over [forecast] [event] happened in an hour', {
          author,
          forecast: data.forecast,
          event: data.forecast === 1 ? 'event' : 'events',
        }),
      };
    }

    if (data.expired_snooze) {
      if (data.expired_snooze.count && data.expired_snooze.window) {
        return {
          title: t('Escalated'),
          message: tct('by [author] because [count] [event] happened in [duration]', {
            author,
            count: data.expired_snooze.count,
            event: data.expired_snooze.count === 1 ? 'event' : 'events',
            duration: <Duration seconds={data.expired_snooze.window * 60} />,
          }),
        };
      }

      if (data.expired_snooze.count) {
        return {
          title: t('Escalated'),
          message: tct('by [author] because [count] [event] happened', {
            author,
            count: data.expired_snooze.count,
            event: data.expired_snooze.count === 1 ? 'event' : 'events',
          }),
        };
      }

      if (data.expired_snooze.user_count && data.expired_snooze.user_window) {
        return {
          title: t('Escalated'),
          message: tct('by [author] because [count] [user] affected in [duration]', {
            author,
            count: data.expired_snooze.user_count,
            user: data.expired_snooze.user_count === 1 ? 'user was' : 'users were',
            duration: <Duration seconds={data.expired_snooze.user_window * 60} />,
          }),
        };
      }

      if (data.expired_snooze.user_count) {
        return {
          title: t('Escalated'),
          message: tct('by [author] because [count] [user] affected', {
            author,
            count: data.expired_snooze.user_count,
            user: data.expired_snooze.user_count === 1 ? 'user was' : 'users were',
          }),
        };
      }

      if (data.expired_snooze.until) {
        return {
          title: t('Escalated'),
          message: tct('by [author] because [date] passed', {
            author,
            date: <DateTime date={data.expired_snooze.until} />,
          }),
        };
      }
    }

    return {
      title: t('Escalated'),
      message: tct('by [author]', {author}),
    }; // should not reach this
  }

  function renderContent(): {
    message: JSX.Element | string | null;
    title: JSX.Element | string;
  } {
    switch (activity.type) {
      case GroupActivityType.NOTE:
        return {
          title: tct('[author]', {author}),
          message: activity.data.text,
        };
      case GroupActivityType.SET_RESOLVED:
        let resolvedMessage: JSX.Element;
        if ('integration_id' in activity.data && activity.data.integration_id) {
          resolvedMessage = tct('by [author] via [integration]', {
            integration: (
              <Link
                to={`/settings/${organization.slug}/integrations/${activity.data.provider_key}/${activity.data.integration_id}/`}
              >
                {activity.data.provider}
              </Link>
            ),
            author,
          });
        } else {
          resolvedMessage = tct('by [author]', {author});
        }
        return {
          title: t('Resolved'),
          message: resolvedMessage,
        };
      case GroupActivityType.SET_RESOLVED_BY_AGE:
        return {
          title: t('Resolved'),
          message: tct('by [author] due to inactivity', {
            author,
          }),
        };
      case GroupActivityType.SET_RESOLVED_IN_RELEASE:
        // Resolved in the next release
        if ('current_release_version' in activity.data) {
          const currentVersion = activity.data.current_release_version;
          return {
            title: t('Resolved'),
            message: tct('by [author] in releases greater than [version] [semver]', {
              author,
              version: <ActivityRelease project={project} version={currentVersion} />,
              semver: isSemverRelease(currentVersion) ? t('(semver)') : t('(non-semver)'),
            }),
          };
        }
        const version = activity.data.version;
        return {
          title: t('Resolved'),
          message: version
            ? tct('by [author] in [version] [semver]', {
                author,
                version: <ActivityRelease project={project} version={version} />,
                semver: isSemverRelease(version) ? t('(semver)') : t('(non-semver)'),
              })
            : tct('by [author] in the upcoming release', {
                author,
              }),
        };
      case GroupActivityType.SET_RESOLVED_IN_COMMIT:
        const deployedReleases = (activity.data.commit?.releases || [])
          .filter(r => r.dateReleased !== null)
          .sort(
            (a, b) => moment(a.dateReleased).valueOf() - moment(b.dateReleased).valueOf()
          );
        if (deployedReleases.length === 1 && activity.data.commit) {
          return {
            title: t('Resolved'),
            message: tct(
              'by [author] in [version]. This commit was released in [release]',
              {
                author,
                version: (
                  <CommitLink
                    inline
                    commitId={activity.data.commit.id}
                    repository={activity.data.commit.repository}
                  />
                ),
                release: (
                  <ActivityRelease
                    project={project}
                    version={deployedReleases[0].version}
                  />
                ),
              }
            ),
          };
        }
        if (deployedReleases.length > 1 && activity.data.commit) {
          return {
            title: t('Resolved'),
            message: tct(
              'by [author] in [version]. This commit was released in [release] and [otherCount] others',
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
                release: (
                  <ActivityRelease
                    project={project}
                    version={deployedReleases[0].version}
                  />
                ),
              }
            ),
          };
        }
        if (activity.data.commit) {
          return {
            title: t('Resolved'),
            message: tct('by [author] in [commit]', {
              author,
              commit: (
                <CommitLink
                  inline
                  commitId={activity.data.commit.id}
                  repository={activity.data.commit.repository}
                />
              ),
            }),
          };
        }
        return {
          title: t('Resolved'),
          message: tct('by [author] in a commit', {author}),
        };
      case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST: {
        const {data} = activity;
        const {pullRequest} = data;
        return {
          title: t('Pull Request Created'),
          message: tct(' by [author]: [pullRequest]', {
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
          }),
        };
      }
      case GroupActivityType.SET_UNRESOLVED: {
        // TODO(nisanthan): Remove after migrating records to SET_ESCALATING
        const {data} = activity;
        if ('forecast' in data && data.forecast) {
          return {
            title: t('Escalated'),
            message: tct(
              ' by [author] because over [forecast] [event] happened in an hour',
              {
                author,
                forecast: data.forecast,
                event: data.forecast === 1 ? 'event' : 'events',
              }
            ),
          };
        }
        if ('integration_id' in data && data.integration_id) {
          return {
            title: t('Unresolved'),
            message: tct('by [author] via [integration]', {
              integration: (
                <Link
                  to={`/settings/${organization.slug}/integrations/${data.provider_key}/${data.integration_id}/`}
                >
                  {data.provider}
                </Link>
              ),
              author,
            }),
          };
        }
        return {
          title: t('Unresolved'),
          message: tct('by [author]', {author}),
        };
      }
      case GroupActivityType.SET_IGNORED: {
        const {data} = activity;
        return getIgnoredMessage(data);
      }
      case GroupActivityType.SET_PUBLIC:
        return {
          title: t('Made Public'),
          message: tct('by [author]', {author}),
        };
      case GroupActivityType.SET_PRIVATE:
        return {
          title: t('Made Private'),
          message: tct('by [author]', {author}),
        };
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
                    <ActivityRelease project={project} version={data.version} />
                  ),
                  resolvedVersion: (
                    <ActivityRelease
                      project={project}
                      version={data.resolved_in_version}
                    />
                  ),
                  comparison: data.follows_semver ? t('semver') : t('release date'),
                }
              )}
            </Subtext>
          );
        }

        return {
          title: t('Regressed'),
          message: data.version
            ? tct('by [author] in [version]. [subtext]', {
                author,
                version: <ActivityRelease project={project} version={data.version} />,
                subtext,
              })
            : tct('by [author]', {
                author,
                subtext,
              }),
        };
      }
      case GroupActivityType.CREATE_ISSUE: {
        const {data} = activity;
        let title = t('Created Issue');
        if (data.new === true) {
          title = t('Linked Issue');
        }

        return {
          title: title,
          message: tct('by [author] on [provider] titled [title]', {
            author,
            provider: data.provider,
            title: <ExternalLink href={data.location}>{data.title}</ExternalLink>,
          }),
        };
      }
      case GroupActivityType.MERGE:
        return {
          title: t('Merged'),
          message: tn(
            '%1$s issue into this issue by %2$s',
            '%1$s issues into this issue by %2$s',
            activity.data.issues.length,
            author
          ),
        };
      case GroupActivityType.UNMERGE_SOURCE: {
        const {data} = activity;
        const {destination, fingerprints} = data;
        return {
          title: t('Unmerged'),
          message: tn(
            '%1$s fingerprint to %3$s by %2$s',
            '%1$s fingerprints to %3$s by %2$s',
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
          ),
        };
      }
      case GroupActivityType.UNMERGE_DESTINATION: {
        const {data} = activity;
        const {source, fingerprints} = data;
        return {
          title: t('Unmerged'),
          message: tn(
            '%1$s fingerprint from %3$s by %2$s',
            '%1$s fingerprints from %3$s by %2$s',
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
          ),
        };
      }
      case GroupActivityType.FIRST_SEEN:
        if (activity.data.priority) {
          return {
            title: t('First Seen'),
            message: tct('Marked as [priority] priority', {
              priority: activity.data.priority,
            }),
          };
        }
        return {
          title: t('First Seen'),
          message: null,
        };
      case GroupActivityType.ASSIGNED: {
        return getAssignedMessage(activity);
      }
      case GroupActivityType.UNASSIGNED:
        return {
          title: t('Unassigned'),
          message: tct('by [author]', {author}),
        };

      case GroupActivityType.REPROCESS: {
        const {data} = activity;
        const {oldGroupId, eventCount} = data;

        return {
          title: t('Resprocessed Events'),
          message: tct('by [author]. [new-events]', {
            author,
            ['new-events']: (
              <Link
                to={`/organizations/${organization.slug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}&referrer=group-activity-reprocesses`}
              >
                {tn('See %s new event', 'See %s new events', eventCount)}
              </Link>
            ),
          }),
        };
      }
      case GroupActivityType.MARK_REVIEWED: {
        return {
          title: t('Reviewed'),
          message: tct('by [author]', {
            author,
          }),
        };
      }
      case GroupActivityType.AUTO_SET_ONGOING: {
        return {
          title: t('Marked as Ongoing'),
          message: activity.data?.afterDays
            ? tct('automatically by [author] after [afterDays] days', {
                author,
                afterDays: activity.data.afterDays,
              })
            : tct('automatically by [author]', {
                author,
              }),
        };
      }
      case GroupActivityType.SET_ESCALATING: {
        return getEscalatingMessage(activity.data);
      }
      case GroupActivityType.SET_PRIORITY: {
        const {data} = activity;
        switch (data.reason) {
          case 'escalating':
            return {
              title: t('Priority Updated'),
              message: tct('by [author] to be [priority] after it escalated', {
                author,
                priority: data.priority,
              }),
            };
          case 'ongoing':
            return {
              title: t('Priority Updated'),
              message: tct(
                'by [author] to be [priority] after it was marked as ongoing',
                {author, priority: data.priority}
              ),
            };
          default:
            return {
              title: t('Priority Updated'),
              message: tct('by [author] to be [priority]', {
                author,
                priority: data.priority,
              }),
            };
        }
      }
      case GroupActivityType.DELETED_ATTACHMENT:
        return {
          title: t('Attachment Deleted'),
          message: tct('by [author]', {author}),
        };
      default:
        return {title: '', message: ''}; // should never hit (?)
    }
  }
  return renderContent();
}

function ActivityRelease({project, version}: {project: Project; version: string}) {
  const organization = useOrganization();
  return (
    <VersionHoverCard
      organization={organization}
      projectSlug={project.slug}
      releaseVersion={version}
    >
      <ReleaseVersion version={version} projectId={project.id} />
    </VersionHoverCard>
  );
}

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

const ReleaseVersion = styled(Version)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
`;
