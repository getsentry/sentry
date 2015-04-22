/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var ApiMixin = require("../mixins/apiMixin");
var GroupActivity = require("./groupDetails/activity");
var GroupChart = require("./groupDetails/chart");
var GroupEvent = require("./groupDetails/event");
var GroupEventToolbar = require("./groupDetails/eventToolbar");
var GroupState = require("../mixins/groupState");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var RouteMixin = require("../mixins/routeMixin");
var TimeSince = require("../components/timeSince");
var utils = require("../utils");

var MutedBox = React.createClass({
  render() {
    if (this.props.status !== 'muted') {
      return <div />;
    }
    return (
      <div className="alert alert-info">
        This event has been muted. You will not be notified of any changes and it will not show up in the default feed.
      </div>
    );
  }
});

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
          <div className="col-md-8 bordered-column">
            <GroupActivity group={group} />
          </div>
          <div className="col-md-4 bordered-column">
            <GroupChart statsPeriod={this.props.statsPeriod} group={group} />
            <div className="row group-stats">
              <div className="col-md-6">
                <h6>First seen</h6>
                <h3><TimeSince date={group.firstSeen} /></h3>
                <h6>Last seen</h6>
                <h3><TimeSince date={group.lastSeen} /></h3>
              </div>
              <div className="col-md-6">
                <h6>In release</h6>
                <h3 className="truncate">{firstRelease}</h3>
                <h6>Status</h6>
                <h3>{group.status}</h3>
              </div>
            </div>
          </div>
        </div>

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

module.exports = GroupOverview;
