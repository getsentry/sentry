import marked from 'marked';
import React from 'react';

import Duration from '../../components/duration';
import Gravatar from '../../components/gravatar';
import MemberListStore from '../../stores/memberListStore';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';

import {t, tn} from '../../locale';


const ActivityItem = React.createClass({
  formatProjectActivity(author, item) {
    let data = item.data;
    let orgId = this.props.orgId;
    let project = item.project;

    switch(item.type) {
      case 'note':
        return t('%s left a comment', author);
      case 'set_resolved':
        return t('%s marked this issue as resolved', author);
      case 'set_resolved_in_release':
        return (data.version ?
          t('%(author)s marked this issue as resolved in %(version)s', {
            author: author,
            version: <Version version={data.version} orgId={orgId} projectId={project.slug} />
          })
        :
          t('%s marked this issue as resolved in the upcoming release', author)
        );
      case 'set_unresolved':
        return t('%s marked this issue as unresolved', author);
      case 'set_muted':
        if (data.snoozeDuration) {
          return t('%(author)s snoozed this issue for %(duration)s', {
            author: author,
            duration: <Duration seconds={data.snoozeDuration * 60} />
          });
        }
        return t('%s muted this issue', author);
      case 'set_public':
        return t('%s made this issue public', author);
      case 'set_private':
        return t('%s made this issue private', author);
      case 'set_regression':
        return (data.version ?
          t('%(author)s marked this issue as a regression in %(version)s', {
            author: author,
            version: <Version version={data.version} orgId={orgId} projectId={project.slug} />
          })
        :
          t('%s marked this issue as a regression', author)
        );
      case 'create_issue':
        return t('created an issue on %(provider)s titled %(title)s', {
          provider: data.provider,
          title: <a href={data.location}>{data.title}</a>
        });
      case 'first_seen':
        return t('%s first saw this issue', author);
      case 'assigned':
        let assignee;
        if (data.assignee === item.user.id) {
          assignee = 'themselves';
          return t('%s assigned this event to themselves', author);
        } else {
          assignee = MemberListStore.getById(data.assignee);
          if (assignee.email) {
            return t('%(author)s assigned this event to %(assignee)s', {
              author: author,
              assignee: assignee.email
            });
          } else {
            return t('%s assigned this event to an unknown user', author);
          }
        }
        return t('%(author)s assigned this event to %(assignee)s', {
          author: author,
          assignee: assignee.email
        });
      case 'unassigned':
        return t('%s unassigned this issue', author);
      case 'merge':
        return tn('%2$s merged %1$d issue into this isssue',
                  '%2$s merged %1$d issues into this isssue',
                  data.issues.length,
                  author);
      case 'release':
        return t('%(author)s released version %(version)s of %(project)s', {
          author: author,
          project: <strong>{project.name}</strong>,
          version: <Version version={data.version} orgId={orgId} projectId={project.slug} />
        });
      default:
        return ''; // should never hit (?)
    }
  },

  render() {
    let item = this.props.item;

    let avatar = (item.user ?
      <Gravatar email={item.user.email} size={64} className="avatar" /> :
      <div className="avatar sentry"><span className="icon-sentry-logo"></span></div>);

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
            <TimeSince date={item.dateCreated} />
            <div className="activity-item-bubble" dangerouslySetInnerHTML={{__html: noteBody}} />
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
            <TimeSince date={item.dateCreated} />
          </div>
        </li>
      );
    }
  },
});

export default ActivityItem;
