/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var ApiMixin = require("../mixins/apiMixin");
var GroupChart = require("./groupDetails/chart");
var GroupEvent = require("./groupDetails/event");
var GroupEventToolbar = require("./groupDetails/eventToolbar");
var GroupState = require("../mixins/groupState");
var MutedBox = require("../components/mutedBox");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var RouteMixin = require("../mixins/routeMixin");
var TimeSince = require("../components/timeSince");
var utils = require("../utils");


var GroupEventDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    ApiMixin,
    GroupState,
    RouteMixin
  ],

  propTypes: {
    statsPeriod: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      event: null,
      eventNavLinks: ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(prevPath) {
    this.fetchData();
  },

  fetchData() {
    var eventId = this.context.router.getCurrentParams().eventId || 'latest';

    var url = (eventId === 'latest' ?
      '/groups/' + this.getGroup().id + '/events/' + eventId + '/' :
      '/events/' + eventId + '/');

    this.setState({
      loading: true,
      error: false
    });

    this.apiRequest(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          event: data,
          error: false,
          loading: false
        });

        api.bulkUpdate({
          orgId: this.getOrganization().slug,
          projectId: this.getProject().slug,
          itemIds: [this.getGroup().id],
          failSilently: true,
          data: {hasSeen: true}
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  render() {
    var group = this.getGroup();
    var evt = this.state.event;
    var params = this.context.router.getCurrentParams();

    return (
      <div>
        <MutedBox status={group.status} />
        {evt &&
          <GroupEventToolbar
              group={group}
              event={evt}
              orgId={params.orgId}
              projectId={params.projectId} />
        }
        {this.state.loading ?
          <LoadingIndicator />
        : (this.state.error ?
          <LoadingError onRetry={this.fetchData} />
        :
          <div>
            <GroupEvent group={group} event={evt} />
          </div>
        )}
      </div>
    );
  }
});

module.exports = GroupEventDetails;
