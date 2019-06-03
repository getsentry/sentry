import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import Avatar from 'app/components/avatar';
import DateTime from 'app/components/dateTime';
import DeviceName from 'app/components/deviceName';
import FileSize from 'app/components/fileSize';
import withOrganization from 'app/utils/withOrganization';
import AttachmentUrl from 'app/utils/attachmentUrl';

class EventsTableRow extends React.Component {
  static propTypes = {
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
    const {event, projectId} = this.props;
    if (!event.crashFile) {
      return null;
    }

    const crashFileType =
      event.crashFile.type === 'event.minidump' ? 'Minidump' : 'Crash file';

    return (
      <AttachmentUrl projectId={projectId} event={event} attachment={event.crashFile}>
        {downloadUrl =>
          downloadUrl && (
            <small>
              {crashFileType}: <a href={downloadUrl}>{event.crashFile.name}</a> (
              <FileSize bytes={event.crashFile.size} />)
            </small>
          )
        }
      </AttachmentUrl>
    );
  }

  render() {
    const {className, event, orgId, groupId, tagList, hasUser} = this.props;
    const tagMap = {};
    event.tags.forEach(tag => {
      tagMap[tag.key] = tag.value;
    });

    const basePath = `/organizations/${orgId}/issues/`;

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
