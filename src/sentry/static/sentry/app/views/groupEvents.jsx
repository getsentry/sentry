/*** @jsx React.DOM */

var React = require("react");

var api = require("../api");
var GroupState = require("../mixins/groupState");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");

var GroupEvents = React.createClass({
  mixins: [GroupState,],

  getInitialState() {
    return {
      eventList: null,
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.getGroup().id + '/events/', {
      success: (data) => {
        this.setState({
          eventList: data,
          error: false,
          loading: false
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

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
        <table>
          {children}
        </table>
      </div>
    );
  }
});

module.exports = GroupEvents;
