import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import classNames from 'classnames';

import CustomPropTypes from 'app/proptypes';
import Avatar from 'app/components/avatar';
import DateTime from 'app/components/dateTime';
import DeviceName from 'app/components/deviceName';

import 'app/../less/components/eventsTableRow.less';

class EventsTableRow extends React.Component {
  static propTypes = {
    hasUser: PropTypes.bool,
    truncate: PropTypes.bool,
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    event: CustomPropTypes.Event.isRequired,
    tagList: PropTypes.arrayOf(CustomPropTypes.Tag),
  };

  static defaultProps = {truncate: false};

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

  render() {
    let {
      className,
      event,
      orgId,
      projectId,
      groupId,
      tagList,
      truncate,
      hasUser,
    } = this.props;
    let cx = classNames('events-table-row', className);
    let tagMap = {};
    event.tags.forEach(tag => {
      tagMap[tag.key] = tag.value;
    });

    return (
      <tr key={event.id} className={cx}>
        <td>
          <h5 className={truncate ? 'truncate' : ''}>
            <Link to={`/${orgId}/${projectId}/issues/${groupId}/events/${event.id}/`}>
              <DateTime date={event.dateCreated} />
            </Link>
            <small>{(this.getEventTitle(event) || '').substr(0, 100)}</small>
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
              <div className={truncate ? 'truncate' : ''}>
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
