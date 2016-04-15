import React from 'react';
import Router from 'react-router';
import EventStore from '../../stores/eventStore';
import Gravatar from '../gravatar';
import TimeSince from '../timeSince';

const EventRow = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired,
    orgSlug: React.PropTypes.string.isRequired,
    projectSlug: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      event: EventStore.get(this.props.id)
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        event: EventStore.get(this.props.id)
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return false;
  },

  render() {
    let event = this.state.event;
    let eventLink = `/${this.props.orgSlug}/${this.props.projectSlug}/issues/${event.groupID}/events/${event.id}/`;

    let tagList = [];
    for (let key in event.tags) {
      tagList.push([key, event.tags[key]]);
    }

    return (
      <tr>
        <td>
          <h5>
            <Router.Link to={eventLink}>{event.message}</Router.Link>
          </h5>
          <small className="tagList">{tagList.map((tag) => {
            return <span key={tag[0]}>{tag[0]} = {tag[1]} </span>;
          })}</small>
        </td>
        <td className="event-user table-user-info">
          {event.user ?
            <div>
              <Gravatar user={event.user} size={64} className="avatar" />
              {event.user.email}
            </div>
          :
            <span>&mdash;</span>
          }
        </td>
        <td className="align-right">
          <TimeSince date={event.dateCreated} />
        </td>
      </tr>
    );
  }
});

export default EventRow;
