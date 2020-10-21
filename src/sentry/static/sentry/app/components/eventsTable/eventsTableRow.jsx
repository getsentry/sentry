import PropTypes from 'prop-types';
import {Component} from 'react';

import AttachmentUrl from 'app/utils/attachmentUrl';
import UserAvatar from 'app/components/avatar/userAvatar';
import DateTime from 'app/components/dateTime';
import DeviceName from 'app/components/deviceName';
import FileSize from 'app/components/fileSize';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class EventsTableRow extends Component {
  static propTypes = {
    hasUser: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    event: SentryTypes.Event.isRequired,
    tagList: PropTypes.arrayOf(SentryTypes.Tag),
  };

  renderCrashFileLink() {
    const {event, projectId} = this.props;
    if (!event.crashFile) {
      return null;
    }

    const crashFileType =
      event.crashFile.type === 'event.minidump' ? 'Minidump' : 'Crash file';

    return (
      <AttachmentUrl
        projectId={projectId}
        eventId={event.id}
        attachment={event.crashFile}
      >
        {url =>
          url && (
            <small>
              {crashFileType}: <a href={`${url}?download=1`}>{event.crashFile.name}</a> (
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
    const link = `/organizations/${orgId}/issues/${groupId}/events/${event.id}/`;

    return (
      <tr key={event.id} className={className}>
        <td>
          <h5>
            <GlobalSelectionLink to={link}>
              <DateTime date={event.dateCreated} />
            </GlobalSelectionLink>
            <small>{event.title.substr(0, 100)}</small>
            {this.renderCrashFileLink()}
          </h5>
        </td>

        {hasUser && (
          <td className="event-user table-user-info">
            {event.user ? (
              <div>
                <UserAvatar
                  user={event.user}
                  size={24}
                  className="avatar"
                  gravatar={false}
                />
                {event.user.email}
              </div>
            ) : (
              <span>—</span>
            )}
          </td>
        )}

        {tagList.map(tag => (
          <td key={tag.key}>
            <div>
              {tag.key === 'device' ? (
                <DeviceName value={tagMap[tag.key]} />
              ) : (
                tagMap[tag.key]
              )}
            </div>
          </td>
        ))}
      </tr>
    );
  }
}

export {EventsTableRow};
export default withOrganization(EventsTableRow);
