/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var PropTypes = require("../proptypes");

var AggregateEvents = React.createClass({
  mixins: [Router.State],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
  },

  getInitialState() {
    return {
      eventList: null,
      loading: true
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var params = this.getParams();

    this.setState({loading: true});

    api.request('/groups/' + params.aggregateId + '/events/', {
      success: (data) => {
        this.setState({eventList: data});
      },
      error: () => {
        // TODO(dcramer):
      },
      complete: () => {
        this.setState({loading: false});
      }
    });
  },


  render() {
    var children = [];

    if (this.state.eventList) {
      children = this.state.eventList.map((event, eventIdx) => {
        return (
          <tr key={eventIdx}>
            <td>{event.message}</td>
          </tr>
        );
      });
    }

    return (
      <div>
        Events
        <table>
          {children}
        </table>
      </div>
    );
  }
});

module.exports = AggregateEvents;
