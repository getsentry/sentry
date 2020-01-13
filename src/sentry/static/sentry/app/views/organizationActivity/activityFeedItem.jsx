import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {t, tn, tct} from 'app/locale';
import UserAvatar from 'app/components/avatar/userAvatar';
import CommitLink from 'app/components/commitLink';
import Duration from 'app/components/duration';
import IssueLink from 'app/components/issueLink';
import MemberListStore from 'app/stores/memberListStore';
import PullRequestLink from 'app/components/pullRequestLink';
import SentryTypes from 'app/sentryTypes';
import TeamStore from 'app/stores/teamStore';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import VersionHoverCard from 'app/components/versionHoverCard';
import marked from 'app/utils/marked';
import space from 'app/styles/space';

class ActivityItem extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    clipHeight: PropTypes.number,
    defaultClipped: PropTypes.bool,
    item: PropTypes.object.isRequired,
  };

  static defaultProps = {
    defaultClipped: false,
    clipHeight: 68,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      clipped: this.props.defaultClipped,
    };
    this.activityBubbleRef = React.createRef();
  }

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

  formatProjectActivity = (author, item) => {
    const data = item.data;
    const orgId = this.props.organization.slug;
    const project = item.project;
    const issue = item.issue;
    const basePath = `/organizations/${orgId}/issues/`;

    const issueLink = issue ? (
      <IssueLink
        organization={this.props.organization}
        orgId={orgId}
        projectId={project.slug}
        issue={issue}
        to={`${basePath}${issue.id}/`}
      >
        {issue.shortId}
      </IssueLink>
    ) : null;

    const versionLink = data.version ? (
      <VersionHoverCard orgId={orgId} projectId={project.slug} version={data.version}>
        <Version version={data.version} orgId={orgId} projectId={null} />
      </VersionHoverCard>
    ) : null;

    switch (item.type) {
      case 'note':
        return tct('[author] commented on [issue]', {
          author,
          issue: (
            <IssueLink
              organization={this.props.organization}
              orgId={orgId}
              projectId={project.slug}
              issue={issue}
              to={`${basePath}${issue.id}/activity/#event_${item.id}`}
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
        if (data.version) {
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
        return tct('[author] marked [issue] as resolved in [version]', {
          author,
          version: (
            <CommitLink
              inline
              commitId={data.commit && data.commit.id}
              repository={data.commit && data.commit.repository}
            />
          ),
          issue: issueLink,
        });
      case 'set_resolved_in_pull_request':
        return tct('[author] marked [issue] as resolved in [version]', {
          author,
          version: (
            <PullRequestLink
              inline
              pullRequest={data.pullRequest}
              repository={data.pullRequest && data.pullRequest.repository}
            />
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
        } else if (data.ignoreCount && data.ignoreWindow) {
          return tct(
            '[author] ignored [issue] until it happens [count] time(s) in [duration]',
            {
              author,
              count: data.ignoreCount,
              duration: <Duration seconds={data.ignoreWindow * 60} />,
              issue: issueLink,
            }
          );
        } else if (data.ignoreCount) {
          return tct('[author] ignored [issue] until it happens [count] time(s)', {
            author,
            count: data.ignoreCount,
            issue: issueLink,
          });
        } else if (data.ignoreUserCount && data.ignoreUserWindow) {
          return tct(
            '[author] ignored [issue] until it affects [count] user(s) in [duration]',
            {
              author,
              count: data.ignoreUserCount,
              duration: <Duration seconds={data.ignoreUserWindow * 60} />,
              issue: issueLink,
            }
          );
        } else if (data.ignoreUserCount) {
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
        } else if (data.assigneeEmail) {
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
          link: <Link to={`${basePath}${issue.id}/`} />,
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
      default:
        return ''; // should never hit (?)
    }
  };

  render() {
    const item = this.props.item;

    let bubbleClassName = 'activity-item-bubble';
    if (this.state.clipped) {
      bubbleClassName += ' clipped';
    }

    const avatar = item.user ? (
      <UserAvatar user={item.user} size={36} className="activity-avatar" />
    ) : (
      <div className="activity-avatar avatar sentry">
        <span className="icon-sentry-logo" />
      </div>
    );

    const author = {
      name: item.user ? item.user.name : 'Sentry',
      avatar,
    };

    const projectLink = <strong>{item.project.slug}</strong>;

    if (item.type === 'note') {
      const noteBody = marked(item.data.text);
      return (
        <div data-test-id="activity-item" className="activity-item activity-item-compact">
          <div className="activity-item-content">
            {this.formatProjectActivity(
              <span>
                {author.avatar}
                <ActivityAuthor>{author.name}</ActivityAuthor>
              </span>,
              item
            )}
            <div
              className={bubbleClassName}
              ref={this.activityBubbleRef}
              dangerouslySetInnerHTML={{__html: noteBody}}
            />
            <div className="activity-meta">
              {projectLink}
              <span className="bullet" />
              <StyledTimeSince date={item.dateCreated} />
            </div>
          </div>
        </div>
      );
    } else if (item.type === 'create_issue') {
      return (
        <div data-test-id="activity-item" className="activity-item activity-item-compact">
          <div className="activity-item-content">
            {this.formatProjectActivity(
              <span>
                {author.avatar}
                <ActivityAuthor>{author.name}</ActivityAuthor>
              </span>,
              item
            )}
            <div className="activity-item-bubble">
              <a href={item.data.location}>{item.data.title}</a>
            </div>
            <div className="activity-meta">
              {projectLink}
              <span className="bullet" />
              <StyledTimeSince date={item.dateCreated} />
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div data-test-id="activity-item" className="activity-item activity-item-compact">
          <div className="activity-item-content">
            {this.formatProjectActivity(
              <span>
                {author.avatar}
                <ActivityAuthor>{author.name}</ActivityAuthor>
              </span>,
              item
            )}
            <div className="activity-meta">
              {projectLink}
              <span className="bullet" />
              <StyledTimeSince date={item.dateCreated} />
            </div>
          </div>
        </div>
      );
    }
  }
}

export default ActivityItem;

const ActivityAuthor = styled('span')`
  font-weight: 600;
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray2};
  padding-left: ${space(1)};
`;
