var React = require("react");
var Router = require("react-router");

var api = require("../api");
var ApiMixin = require("../mixins/apiMixin");
var Count = require("../components/count");
var DateTime = require("../components/dateTime");
var GroupChart = require("./groupDetails/chart");
var GroupEventEntries = require("../components/eventEntries");
var GroupState = require("../mixins/groupState");
var MutedBox = require("../components/mutedBox");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var RouteMixin = require("../mixins/routeMixin");
var TimeSince = require("../components/timeSince");
var utils = require("../utils");
var Version = require("../components/version");

var SeenInfo = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired,
    release: React.PropTypes.shape({
      version: React.PropTypes.string.isRequired
    })
  },

  render() {
    var {date, release} = this.props;
    return (
      <dl>
        <dt>When:</dt>
        <dd><TimeSince date={date} /></dd>
        <dt>Date:</dt>
        <dd><DateTime date={date} /></dd>
        {utils.defined(release) && [
          <dt>Release:</dt>,
          <dd><Version version={release.version} /></dd>
        ]}
      </dl>
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
    var url = '/groups/' + this.getGroup().id + '/events/latest/';

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
    var orgId = this.getOrganization().slug;
    var projectId = this.getProject().slug;

    var tagList = [];
    var tagData;
    for (var key in group.tags) {
      tagData = group.tags[key];
      tagList.push([key, tagData.label, tagData.count]);
    }
    tagList.sort();

    return (
      <div>
        <div className="row group-overview">
          <div className="col-md-3 group-stats-column">
            <div className="group-stats">
              <GroupChart statsPeriod="24h" group={group}
                          title="Last 24 Hours"
                          firstSeen={group.firstSeen}
                          lastSeen={group.lastSeen} />
              <GroupChart statsPeriod="30d" group={group}
                          title="Last 30 Days"
                          className="bar-chart-small"
                          firstSeen={group.firstSeen}
                          lastSeen={group.lastSeen} />

              <h6 className="first-seen">First seen</h6>
              <SeenInfo
                  orgId={orgId}
                  projectId={projectId}
                  date={group.firstSeen}
                  release={group.firstRelease} />

              <h6 className="last-seen">Last seen</h6>
              <SeenInfo
                  orgId={orgId}
                  projectId={projectId}
                  date={group.lastSeen}
                  release={group.lastRelease} />

              <h6>Status</h6>
              <h3>{group.status}</h3>
              {tagList.map((data) => {
                // var {key, label, count} = data;
                var key = data[0];
                var label = data[1];
                var count = data[2];

                return [
                  <h6>{label}</h6>,
                  <Count value={count} />
                ];
              })}
            </div>
          </div>
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
        </div>
      </div>
    );
  }
});

module.exports = GroupOverview;
