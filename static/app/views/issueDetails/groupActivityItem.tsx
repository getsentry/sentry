import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import CommitLink from 'sentry/components/commitLink';
import Duration from 'sentry/components/duration';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import PullRequestLink from 'sentry/components/pullRequestLink';
import Version from 'sentry/components/version';
import {t, tct, tn} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {
  GroupActivity,
  GroupActivityAssigned,
  GroupActivitySetIgnored,
  GroupActivityType,
  Organization,
  Project,
  User,
} from 'sentry/types';

type Props = {
  activity: GroupActivity;
  author: React.ReactNode;
  orgSlug: Organization['slug'];
  projectId: Project['id'];
};

function GroupActivityItem({activity, orgSlug, projectId, author}: Props) {
  const issuesLink = `/organizations/${orgSlug}/issues/`;

  function getIgnoredMessage(data: GroupActivitySetIgnored['data']) {
    if (data.ignoreDuration) {
      return tct('[author] ignored this issue for [duration]', {
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

    return tct('[author] ignored this issue', {author});
  }

  function getAssignedMessage(data: GroupActivityAssigned['data']) {
    let assignee: string | User | undefined = undefined;
    if (data.assigneeType === 'team') {
      const team = TeamStore.getById(data.assignee);
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
        const {current_release_version, version} = activity.data;
        if (current_release_version) {
          return tct(
            '[author] marked this issue as resolved in releases greater than [version]',
            {
              author,
              version: (
                <Version
                  version={current_release_version}
                  projectId={projectId}
                  tooltipRawVersion
                />
              ),
            }
          );
        }
        return version
          ? tct('[author] marked this issue as resolved in [version]', {
              author,
              version: (
                <Version version={version} projectId={projectId} tooltipRawVersion />
              ),
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
        if (deployedReleases.length === 1) {
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
        if (deployedReleases.length > 1) {
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
        return tct('[author] marked this issue as resolved in [version]', {
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
        return tct('[author] has created a PR for this issue: [version]', {
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
        return tct('[author] marked this issue as unresolved', {author});
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
        return data.version
          ? tct('[author] marked this issue as a regression in [version]', {
              author,
              version: (
                <Version version={data.version} projectId={projectId} tooltipRawVersion />
              ),
            })
          : tct('[author] marked this issue as a regression', {author});
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
        const {data} = activity;
        return getAssignedMessage(data);
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
              to={`/organizations/${orgSlug}/issues/?query=reprocessing.original_issue_id:${oldGroupId}&referrer=group-activity-reprocesses`}
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
      default:
        return ''; // should never hit (?)
    }
  }

  return <Fragment>{renderContent()}</Fragment>;
}

export default GroupActivityItem;

const CodeWrapper = styled('div')`
  overflow-wrap: anywhere;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledRuleSpan = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;
