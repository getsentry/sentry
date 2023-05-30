import {Component, createRef} from 'react';
import styled from '@emotion/styled';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import CommitLink from 'sentry/components/commitLink';
import Duration from 'sentry/components/duration';
import IssueLink from 'sentry/components/issueLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import PullRequestLink from 'sentry/components/pullRequestLink';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t, tct, tn} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import {Activity, GroupActivity, Organization} from 'sentry/types';
import marked from 'sentry/utils/marked';

const defaultProps = {
  defaultClipped: false,
  clipHeight: 68,
};
type DefaultProps = typeof defaultProps;

type Props = {
  item: Activity;
  organization: Organization;
  className?: string;
} & DefaultProps;

type State = {
  clipped: Props['defaultClipped'];
};

class ActivityItem extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    clipped: this.props.defaultClipped,
  };

  componentDidMount() {
    if (this.activityBubbleRef.current) {
      const bubbleHeight = this.activityBubbleRef.current.offsetHeight;

      if (bubbleHeight > this.props.clipHeight) {
        // okay if this causes re-render; cannot determine until
        // rendered first anyways
        // eslint-disable-next-line react/no-did-mount-set-state
        this.setState({clipped: true});
      }
    }
  }

  renderVersionLink(version: string, item: GroupActivity) {
    const {organization} = this.props;
    const {project} = item;
    return version ? (
      <VersionHoverCard
        organization={organization}
        projectSlug={project.slug}
        releaseVersion={version}
      >
        <Version version={version} projectId={project.id} />
      </VersionHoverCard>
    ) : null;
  }

  activityBubbleRef = createRef<HTMLDivElement>();

  formatProjectActivity = (author, item) => {
    const data = item.data;
    const {organization} = this.props;
    const orgId = organization.slug;
    const issue = item.issue;
    const basePath = `/organizations/${orgId}/issues/`;

    const issueLink = issue ? (
      <IssueLink
        orgId={orgId}
        issue={issue}
        to={`${basePath}${issue.id}/?referrer=activity-feed-issue-link`}
        card
      >
        {issue.shortId}
      </IssueLink>
    ) : null;

    const versionLink = this.renderVersionLink(data.version, item);

    switch (item.type) {
      case 'note':
        return tct('[author] commented on [issue]', {
          author,
          issue: (
            <IssueLink
              card
              orgId={orgId}
              issue={issue}
              to={`${basePath}${issue.id}/activity/?referrer=activity-comment#event_${item.id}`}
            >
              {issue.shortId}
            </IssueLink>
          ),
        });
      case 'set_resolved':
        return tct('[author] marked [issue] as resolved', {
          author,
          issue: issueLink,
        });
      case 'set_resolved_by_age':
        return tct('[author] marked [issue] as resolved due to age', {
          author,
          issue: issueLink,
        });
      case 'set_resolved_in_release':
        const {current_release_version, version} = item.data;
        if (current_release_version) {
          return tct(
            '[author] marked [issue] as resolved in releases greater than [version]',
            {
              author,
              version: this.renderVersionLink(current_release_version, item),
              issue: issueLink,
            }
          );
        }
        if (version) {
          return tct('[author] marked [issue] as resolved in [version]', {
            author,
            version: versionLink,
            issue: issueLink,
          });
        }
        return tct('[author] marked [issue] as resolved in the upcoming release', {
          author,
          issue: issueLink,
        });
      case 'set_resolved_in_commit':
        if (data.commit) {
          return tct('[author] marked [issue] as resolved in [commit]', {
            author,
            commit: (
              <CommitLink
                inline
                commitId={data.commit.id}
                repository={data.commit.repository}
              />
            ),
            issue: issueLink,
          });
        }
        return tct('[author] marked [issue] as resolved in a commit', {
          author,
          issue: issueLink,
        });
      case 'set_resolved_in_pull_request':
        return tct('[author] marked [issue] as resolved in [pullRequest]', {
          author,
          pullRequest: data.pullRequest ? (
            <PullRequestLink
              inline
              pullRequest={data.pullRequest}
              repository={data.pullRequest.repository}
            />
          ) : (
            t('PR not available')
          ),
          issue: issueLink,
        });
      case 'set_unresolved':
        return tct('[author] marked [issue] as unresolved', {
          author,
          issue: issueLink,
        });
      case 'set_ignored':
        if (data.ignoreDuration) {
          return tct('[author] ignored [issue] for [duration]', {
            author,
            duration: <Duration seconds={data.ignoreDuration * 60} />,
            issue: issueLink,
          });
        }
        if (data.ignoreCount && data.ignoreWindow) {
          return tct(
            '[author] ignored [issue] until it happens [count] time(s) in [duration]',
            {
              author,
              count: data.ignoreCount,
              duration: <Duration seconds={data.ignoreWindow * 60} />,
              issue: issueLink,
            }
          );
        }
        if (data.ignoreCount) {
          return tct('[author] ignored [issue] until it happens [count] time(s)', {
            author,
            count: data.ignoreCount,
            issue: issueLink,
          });
        }
        if (data.ignoreUserCount && data.ignoreUserWindow) {
          return tct(
            '[author] ignored [issue] until it affects [count] user(s) in [duration]',
            {
              author,
              count: data.ignoreUserCount,
              duration: <Duration seconds={data.ignoreUserWindow * 60} />,
              issue: issueLink,
            }
          );
        }
        if (data.ignoreUserCount) {
          return tct('[author] ignored [issue] until it affects [count] user(s)', {
            author,
            count: data.ignoreUserCount,
            issue: issueLink,
          });
        }
        return tct('[author] ignored [issue]', {
          author,
          issue: issueLink,
        });
      case 'set_public':
        return tct('[author] made [issue] public', {
          author,
          issue: issueLink,
        });
      case 'set_private':
        return tct('[author] made [issue] private', {
          author,
          issue: issueLink,
        });
      case 'set_regression':
        if (data.version) {
          return tct('[author] marked [issue] as a regression in [version]', {
            author,
            version: versionLink,
            issue: issueLink,
          });
        }
        return tct('[author] marked [issue] as a regression', {
          author,
          issue: issueLink,
        });
      case 'create_issue':
        return tct('[author] linked [issue] on [provider]', {
          author,
          provider: data.provider,
          issue: issueLink,
        });
      case 'unmerge_destination':
        return tn(
          '%2$s migrated %1$s fingerprint from %3$s to %4$s',
          '%2$s migrated %1$s fingerprints from %3$s to %4$s',
          data.fingerprints.length,
          author,
          data.source ? (
            <a href={`${basePath}${data.source.id}`}>{data.source.shortId}</a>
          ) : (
            t('a group')
          ),
          issueLink
        );
      case 'first_seen':
        return tct('[author] saw [link:issue]', {
          author,
          issue: issueLink,
        });
      case 'assigned':
        let assignee;

        if (data.assigneeType === 'team') {
          const team = TeamStore.getById(data.assignee);
          assignee = team ? team.slug : '<unknown-team>';

          return tct('[author] assigned [issue] to #[assignee]', {
            author,
            issue: issueLink,
            assignee,
          });
        }

        if (item.user && data.assignee === item.user.id) {
          return tct('[author] assigned [issue] to themselves', {
            author,
            issue: issueLink,
          });
        }
        assignee = MemberListStore.getById(data.assignee);
        if (assignee && assignee.email) {
          return tct('[author] assigned [issue] to [assignee]', {
            author,
            assignee: <span title={assignee.email}>{assignee.name}</span>,
            issue: issueLink,
          });
        }
        if (data.assigneeEmail) {
          return tct('[author] assigned [issue] to [assignee]', {
            author,
            assignee: data.assigneeEmail,
            issue: issueLink,
          });
        }
        return tct('[author] assigned [issue] to an [help:unknown user]', {
          author,
          help: <span title={data.assignee} />,
          issue: issueLink,
        });
      case 'unassigned':
        return tct('[author] unassigned [issue]', {
          author,
          issue: issueLink,
        });
      case 'merge':
        return tct('[author] merged [count] [link:issues]', {
          author,
          count: data.issues.length + 1,
          link: <Link to={`${basePath}${issue.id}/?referrer=activity-feed-merge`} />,
        });
      case 'release':
        return tct('[author] released version [version]', {
          author,
          version: versionLink,
        });
      case 'deploy':
        return tct('[author] deployed version [version] to [environment].', {
          author,
          version: versionLink,
          environment: data.environment || 'Default Environment',
        });
      case 'mark_reviewed':
        return tct('[author] marked [issue] as reviewed', {
          author,
          issue: issueLink,
        });
      default:
        return ''; // should never hit (?)
    }
  };

  render() {
    const {className, item} = this.props;

    const avatar = (
      <ActivityAvatar
        type={!item.user ? 'system' : 'user'}
        user={item.user ?? undefined}
        size={36}
      />
    );
    const author = {
      name: item.user ? item.user.name : 'Sentry',
      avatar,
    };

    const hasBubble = ['note', 'create_issue'].includes(item.type);
    const bubbleProps = {
      ...(item.type === 'note'
        ? {dangerouslySetInnerHTML: {__html: marked(item.data.text)}}
        : {}),
      ...(item.type === 'create_issue'
        ? {
            children: (
              <ExternalLink href={item.data.location}>{item.data.title}</ExternalLink>
            ),
          }
        : {}),
    };

    return (
      <div data-test-id="activity-feed-item" className={className}>
        {author.avatar}
        <div>
          {this.formatProjectActivity(
            <span>
              <ActivityAuthor>{author.name}</ActivityAuthor>
            </span>,
            item
          )}
          {hasBubble && (
            <Bubble
              ref={this.activityBubbleRef}
              clipped={this.state.clipped}
              {...bubbleProps}
            />
          )}
          <Meta>
            <Project>{item.project.slug}</Project>
            <StyledTimeSince date={item.dateCreated} />
          </Meta>
        </div>
      </div>
    );
  }
}

export default styled(ActivityItem)`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content auto;
  position: relative;
  margin: 0;
  padding: ${space(1)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  line-height: 1.4;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ActivityAuthor = styled('span')`
  font-weight: 600;
`;

const Meta = styled('div')`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
const Project = styled('span')`
  font-weight: bold;
`;

const Bubble = styled('div')<{clipped: boolean}>`
  background: ${p => p.theme.backgroundSecondary};
  margin: ${space(0.5)} 0;
  padding: ${space(1)} ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 3px;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;

  a {
    max-width: 100%;
    overflow-x: hidden;
    text-overflow: ellipsis;
  }

  p {
    &:last-child {
      margin-bottom: 0;
    }
  }

  ${p =>
    p.clipped &&
    `
    max-height: 68px;

    &:after {
      position: absolute;
      content: '';
      display: block;
      bottom: 0;
      right: 0;
      left: 0;
      height: 36px;
      background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 1));
      border-bottom: 6px solid #fff;
      border-radius: 0 0 3px 3px;
      pointer-events: none;
    }
  `}
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray300};
  padding-left: ${space(1)};
`;
