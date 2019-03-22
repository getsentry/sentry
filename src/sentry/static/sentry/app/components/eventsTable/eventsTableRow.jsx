import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Avatar from 'app/components/avatar';
import DateTime from 'app/components/dateTime';
import DeviceName from 'app/components/deviceName';
import FileSize from 'app/components/fileSize';
import withOrganization from 'app/utils/withOrganization';

class EventsTableRow extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    hasUser: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    event: SentryTypes.Event.isRequired,
    tagList: PropTypes.arrayOf(SentryTypes.Tag),
  };

  getEventTitle = event => {
    // XXX(mitsuhiko): event.title did not exist originally.  At one point
    // all events will have this and most of this logic could go
    switch (event.type) {
      case 'error':
        if (event.metadata.type && event.metadata.value) {
          return `${event.metadata.type}: ${event.metadata.value}`;
        }
        return event.metadata.type || event.metadata.value || event.metadata.title;
      case 'csp':
        return event.metadata.message;
      case 'default':
        return event.metadata.title;
      default:
        return event.title || event.message.split('\n')[0];
    }
  };

  renderCrashFileLink() {
    const {orgId, event, projectId} = this.props;
    if (!event.crashFile) {
      return null;
    }
    const url = `/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${event
      .crashFile.id}/?download=1`;
    const crashFileType =
      event.crashFile.type === 'event.minidump' ? 'Minidump' : 'Crash file';
    return (
      <small>
        {crashFileType}: <a href={url}>{event.crashFile.name}</a> (<FileSize bytes={event.crashFile.size} />)
      </small>
    );
  }

  render() {
    const {
      organization,
      className,
      event,
      orgId,
      projectId,
      groupId,
      tagList,
      hasUser,
    } = this.props;
    const tagMap = {};
    event.tags.forEach(tag => {
      tagMap[tag.key] = tag.value;
    });

    const basePath = new Set(organization.features).has('sentry10')
      ? `/organizations/${orgId}/issues/`
      : `/${orgId}/${projectId}/issues/`;

    return (
      <tr key={event.id} className={className}>
        <td>
          <h5>
            <Link to={`${basePath}${groupId}/events/${event.id}/`}>
              <DateTime date={event.dateCreated} />
            </Link>
            <small>{(this.getEventTitle(event) || '').substr(0, 100)}</small>
            {this.renderCrashFileLink()}
          </h5>
        </td>

        {hasUser && (
          <td className="event-user table-user-info">
            {event.user ? (
              <div>
                <Avatar user={event.user} size={24} className="avatar" gravatar={false} />
                {event.user.email}
              </div>
            ) : (
              <span>—</span>
            )}
          </td>
        )}

        {tagList.map(tag => {
          return (
            <td key={tag.key}>
              <div>
                {tag.key === 'device' ? (
                  <DeviceName>{tagMap[tag.key]}</DeviceName>
                ) : (
                  tagMap[tag.key]
                )}
              </div>
            </td>
          );
        })}
      </tr>
    );
  }
}

export {EventsTableRow};
export default withOrganization(EventsTableRow);
