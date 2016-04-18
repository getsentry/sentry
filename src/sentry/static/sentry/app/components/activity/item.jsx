import marked from 'marked';
import React from 'react';

import Duration from '../../components/duration';
import Gravatar from '../../components/gravatar';
import {Link} from 'react-router';
import MemberListStore from '../../stores/memberListStore';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';

import {tct} from '../../locale';


const ActivityItem = React.createClass({
  propTypes: {
    clipHeight: React.PropTypes.number,
    defaultClipped: React.PropTypes.bool,
    item: React.PropTypes.object.isRequired,
    orgId: React.PropTypes.string.isRequired
  },

  getDefaultProps() {
    return {
      defaultClipped: false,
      clipHeight: 68
    };
  },

  getInitialState() {
    return {
      clipped: this.props.defaultClipped
    };
  },

  componentDidMount() {
    if (this.refs.activityBubble) {
      let bubbleHeight = this.refs.activityBubble.offsetHeight;

      if (bubbleHeight > this.props.clipHeight ) {
        /*eslint react/no-did-mount-set-state:0*/
        // okay if this causes re-render; cannot determine until
        // rendered first anyways
        this.setState({
          clipped: true
        });
      }
    }
  },

  formatProjectActivity(author, item) {
    let data = item.data;
    let orgId = this.props.orgId;
    let project = item.project;
    let issue = item.issue;

    switch(item.type) {
      case 'note':
        return tct('[author] commented on [link:an issue]', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/activity/#event_${item.id}`} />
        });
      case 'set_resolved':
        return tct('[author] marked [link:an issue] as resolved', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'set_resolved_in_release':
        if (data.version) {
          return tct('[author] marked [link:an issue] as resolved in [version]', {
            author: author,
            version: <Version version={data.version} orgId={orgId} projectId={project.slug} />,
            link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
          });
        }
        return tct('[author] marked [link:an issue] as resolved in the upcoming release', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'set_unresolved':
        return tct('[author] marked [link:an issue] as unresolved', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'set_muted':
        if (data.snoozeDuration) {
          return tct('[author] snoozed [link:an issue] for [duration]', {
            author: author,
            duration: <Duration seconds={data.snoozeDuration * 60} />,
            link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
          });
        }
        return tct('[author] muted [link:an issue]', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'set_public':
        return tct('[author] made an [link:an issue] public', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'set_private':
        return tct('[author] made an [link:an issue] private', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'set_regression':
        if (data.version) {
          return tct('[author] marked [link:an issue] as a regression in [version]', {
            author: author,
            version: <Version version={data.version} orgId={orgId} projectId={project.slug} />,
            link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
          });
        }
        return tct('[author] marked [link:an issue] as a regression', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'create_issue':
        return tct('[author] linked [link:an issue] on [provider]', {
          author: author,
          provider: data.provider,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'first_seen':
        return tct('[author] saw [link:a new issue]', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'assigned':
        let assignee;
        if (item.user && data.assignee === item.user.id) {
          return tct('[author] assigned [link:an issue] to themselves', {
            author: author,
            link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
          });
        }
        assignee = MemberListStore.getById(data.assignee);
        if (assignee && assignee.email) {
          return tct('[author] assigned [link:an issue] to [assignee]', {
            author: author,
            assignee: <span title={assignee.email}>{assignee.name}</span>,
            link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
          });
        }
        else if (data.assigneeEmail) {
          return tct('[author] assigned [link:an issue] to [assignee]', {
            author: author,
            assignee: data.assigneeEmail,
            link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
          });
        }
        return tct('[author] assigned [link:an issue] to an [help:unknown user]', {
          author: author,
          help: <span title={data.assignee} />,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'unassigned':
        return tct('[author] unassigned [link:an issue]', {
          author: author,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'merge':
        return tct('[author] merged [count] [link:issues]', {
          author: author,
          count: data.issues.length + 1,
          link: <Link to={`/${orgId}/${project.slug}/issues/${issue.id}/`} />
        });
      case 'release':
        return tct('[author] released version [version]', {
          author: author,
          version: <Version version={data.version} orgId={orgId} projectId={project.slug} />
        });
      default:
        return ''; // should never hit (?)
    }
  },

  render() {
    let item = this.props.item;
    let orgId = this.props.orgId;

    let bubbleClassName = 'activity-item-bubble';
    if (this.state.clipped) {
      bubbleClassName += ' clipped';
    }

    let avatar = (item.user ?
      <Gravatar user={item.user} size={64} className="avatar" /> :
      <div className="avatar sentry"><span className="icon-sentry-logo" /></div>);

    let author = {
      name: item.user ? item.user.name : 'Sentry',
      avatar: avatar,
    };

    if (item.type === 'note') {
      let noteBody = marked(item.data.text);
      return (
        <li className="activity-item activity-item-compact">
          <div className="activity-item-content">
            {this.formatProjectActivity(
              <span>
                {author.avatar}
                <span className="activity-author">{author.name}</span>
              </span>,
              item
            )}
            <div className={bubbleClassName} ref="activityBubble" dangerouslySetInnerHTML={{__html: noteBody}} />
            <div className="activity-meta">
              <Link
                className="project"
                to={`/${orgId}/${item.project.slug}/`}>{item.project.name}</Link>
              <span className="bullet" />
              <TimeSince date={item.dateCreated} />
            </div>
          </div>
        </li>
      );
    } else if (item.type === 'create_issue') {
      return (
        <li className="activity-item activity-item-compact">
          <div className="activity-item-content">
            {this.formatProjectActivity(
              <span>
                {author.avatar}
                <span className="activity-author">{author.name}</span>
              </span>,
              item
            )}
            <div className="activity-item-bubble">
              <a href={item.data.location}>{item.data.title}</a>
            </div>
            <div className="activity-meta">
              <Link
                className="project"
                to={`/${orgId}/${item.project.slug}/`}>{item.project.name}</Link>
              <span className="bullet" />
              <TimeSince date={item.dateCreated} />
            </div>
          </div>
        </li>
      );
    } else {
      return (
        <li className="activity-item activity-item-compact">
          <div className="activity-item-content">
            {this.formatProjectActivity(
              <span>
                {author.avatar}
                <span className="activity-author">{author.name}</span>
              </span>,
              item
            )}
            <div className="activity-meta">
              <Link
                className="project"
                to={`/${orgId}/${item.project.slug}/`}>{item.project.name}</Link>
              <span className="bullet" />
              <TimeSince date={item.dateCreated} />
            </div>
          </div>
        </li>
      );
    }
  },
});

export default ActivityItem;
