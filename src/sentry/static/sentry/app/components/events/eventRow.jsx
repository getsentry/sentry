import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';
import EventStore from 'app/stores/eventStore';
import Avatar from 'app/components/avatar';
import TimeSince from 'app/components/timeSince';

class EventRow extends React.Component {
  static propTypes = {
    id: PropTypes.string.isRequired,
    orgSlug: PropTypes.string.isRequired,
    projectSlug: PropTypes.string.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      event: EventStore.get(this.props.id),
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        event: EventStore.get(this.props.id),
      });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  render() {
    let event = this.state.event;
    let eventLink = `/${this.props.orgSlug}/${this.props
      .projectSlug}/issues/${event.groupID}/events/${event.id}/`;

    let tagList = [];
    for (let key in event.tags) {
      tagList.push([key, event.tags[key]]);
    }

    return (
      <tr>
        <td>
          <h5>
            <Link to={eventLink}>{event.message}</Link>
          </h5>
          <small className="tagList">
            {tagList.map(tag => {
              return (
                <span key={tag[0]}>
                  {tag[0]} = {tag[1]}{' '}
                </span>
              );
            })}
          </small>
        </td>
        <td className="event-user table-user-info">
          {event.user ? (
            <div>
              <Avatar user={event.user} size={64} className="avatar" />
              {event.user.email}
            </div>
          ) : (
            <span>—</span>
          )}
        </td>
        <td className="align-right">
          <TimeSince date={event.dateCreated} />
        </td>
      </tr>
    );
  }
}

export default EventRow;
