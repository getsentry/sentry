import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import CustomPropTypes from 'app/sentryTypes';
import Avatar from 'app/components/avatar';
import DateTime from 'app/components/dateTime';
import DeviceName from 'app/components/deviceName';
import FileSize from 'app/components/fileSize';

class EventsTableRow extends React.Component {
  static propTypes = {
    hasUser: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    event: CustomPropTypes.Event.isRequired,
    tagList: PropTypes.arrayOf(CustomPropTypes.Tag),
  };

  getEventTitle = event => {
    switch (event.type) {
      case 'error':
        if (event.metadata.type && event.metadata.value)
          return `${event.metadata.type}: ${event.metadata.value}`;
        return event.metadata.type || event.metadata.value || event.metadata.title;
      case 'csp':
        return event.metadata.message;
      case 'default':
        return event.metadata.title;
      default:
        return event.message.split('\n')[0];
    }
  };

  renderCrashFileLink() {
    let {orgId, event, projectId} = this.props;
    if (!event.crashFile) {
      return null;
    }
    let url = `/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${event
      .crashFile.id}/?download=1`;
    let crashFileType =
      event.crashFile.type === 'event.minidump' ? 'Minidump' : 'Crash file';
    return (
      <small>
        {crashFileType}: <a href={url}>{event.crashFile.name}</a> (<FileSize bytes={event.crashFile.size} />)
      </small>
    );
  }

  render() {
    let {className, event, orgId, projectId, groupId, tagList, hasUser} = this.props;
    let tagMap = {};
    event.tags.forEach(tag => {
      tagMap[tag.key] = tag.value;
    });

    return (
      <tr key={event.id} className={className}>
        <td>
          <h5>
            <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/${event.id}/`}>
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

export default EventsTableRow;
