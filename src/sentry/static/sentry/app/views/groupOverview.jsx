/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var ApiMixin = require("../mixins/apiMixin");
var GroupChart = require("./groupDetails/chart");
var GroupEventEntries = require("./groupDetails/eventEntries");
var GroupState = require("../mixins/groupState");
var MutedBox = require("../components/mutedBox");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var RouteMixin = require("../mixins/routeMixin");
var TimeSince = require("../components/timeSince");
var utils = require("../utils");

var GroupOverview = React.createClass({
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

    if (evt) {
      var eventNavNodes = [
        (evt.nextEventID ?
          <Router.Link to="groupEventDetails"
            params={{orgId: params.orgId,
                     projectId: params.projectId,
                     groupId: params.groupId,
                     eventId: evt.nextEventID}}
            className="btn btn-default btn-lg">Newer</Router.Link>
        : <a class="btn btn-default btn-lg disabled">Newer</a>),
        (evt.previousEventID ?
          <Router.Link to="groupEventDetails"
            params={{orgId: params.orgId,
                     projectId: params.projectId,
                     groupId: params.groupId,
                     eventId: evt.previousEventID}}
            className="btn btn-default btn-lg">Older</Router.Link>
        : <a class="btn btn-default btn-lg disabled">Older</a>),
      ];
    }

    var firstRelease = (group.firstRelease ?
      group.firstRelease.version :
      <span>&mdash;</span>);

    return (
      <div>
        <div className="row group-overview">
          <div className="col-md-9">
            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            :
              <GroupEventEntries
                  group={group}
                  event={evt} />
            )}
          </div>
          <div className="col-md-3">
            <div className="group-stats">
              <GroupChart statsPeriod="24h" group={group}
                          title="Last 24 Hours" />
              <GroupChart statsPeriod="30d" group={group}
                          title="Last 30 Days"
                          className="bar-chart-small" />
              <h6>First seen</h6>
              <h3><TimeSince date={group.firstSeen} /></h3>

              <h6>Last seen</h6>
              <h3><TimeSince date={group.lastSeen} /></h3>

              <h6>In release</h6>
              <h3 className="truncate">{firstRelease}</h3>

              <h6>Status</h6>
              <h3>{group.status}</h3>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = GroupOverview;
