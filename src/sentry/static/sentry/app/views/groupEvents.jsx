/*** @jsx React.DOM */

var React = require("react");
var {Link} = require("react-router");

var api = require("../api");
var GroupState = require("../mixins/groupState");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");

var GroupEvents = React.createClass({
  mixins: [GroupState],

  getInitialState() {
    return {
      eventList: [],
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

    var children = this.state.eventList.map((event, eventIdx) => {
      var linkParams = {
        orgId: this.getOrganization().slug,
        projectId: this.getProject().slug,
        groupId: this.getGroup().id,
        eventId: event.id
      };

      return (
        <tr key={eventIdx}>
          <td>
            <Link to="groupEventDetails"
                  params={linkParams}>{event.message}</Link>
          </td>
        </tr>
      );
    });

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
