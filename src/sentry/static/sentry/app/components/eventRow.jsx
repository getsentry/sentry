var React = require("react");
var Router = require("react-router");

var EventStore = require("../stores/eventStore");
var Gravatar = require("./gravatar");
var TimeSince = require("./timeSince");

var EventRow = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired
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
    var event = this.state.event;
    var linkParams = {
      eventId: event.id,
      orgId: this.props.orgSlug,
      projectId: this.props.projectSlug,
      groupId: event.groupID
    };

    return (
      <tr>
        <td>
          <h5>
            <Router.Link to="groupEventDetails"
                params={linkParams}>{event.message}</Router.Link>
          </h5>
          <small className="tagList">{event.tags.map((tag, tagIdx) => {
            return <span key={tagIdx}>{tag[0]} = {tag[1]} </span>;
          })}</small>
        </td>
        <td className="event-user table-user-info">
          {event.user ?
            <div>
              <Gravatar email={event.user.email} size={64} className="avatar" />
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

module.exports = EventRow;
