/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var AggregateActivity = require("./aggregate/activity");
var AggregateChart = require("./aggregate/chart");
var AggregateEvent = require("./aggregate/event");
var AggregateEventToolbar = require("./aggregate/eventToolbar");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
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

var AggregateOverview = React.createClass({
  mixins: [Router.State],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
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

  componentWillReceiveProps(nextProps) {
    this.fetchData();
  },

  fetchData() {
    var eventId = this.getParams().eventId || 'latest';

    var url = (eventId === 'latest' ?
      '/groups/' + this.props.aggregate.id + '/events/' + eventId + '/' :
      '/events/' + eventId + '/');

    this.setState({
      loading: true,
      error: false
    });

    api.request(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          event: data,
          error: false,
          loading: false
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
    var agg = this.props.aggregate;
    var evt = this.state.event;
    var params = this.getParams();

    if (evt) {
      var eventNavNodes = [
        (evt.nextEventID ?
          <Router.Link to="aggregateEventDetails"
            params={{orgId: params.orgId,
                     projectId: params.projectId,
                     aggId: params.aggId,
                     eventId: evt.nextEventID}}
            className="btn btn-default btn-lg">Newer</Router.Link>
        : <a class="btn btn-default btn-lg disabled">Newer</a>),
        (evt.previousEventID ?
          <Router.Link to="aggregateEventDetails"
            params={{orgId: params.orgId,
                     projectId: params.projectId,
                     aggId: params.aggId,
                     eventId: evt.previousEventID}}
            className="btn btn-default btn-lg">Older</Router.Link>
        : <a class="btn btn-default btn-lg disabled">Older</a>),
      ];
    }

    return (
      <div>
        <div className="row">
          <div className="col-md-6">
            <AggregateActivity aggregate={agg} />
          </div>
          <div className="col-md-6">
            <AggregateChart
                aggregate={agg}
                statsPeriod={this.props.statsPeriod} />
            <div className="row group-stats">
              <div className="col-md-6">
                <h6>First seen</h6>
                <h3><TimeSince date={agg.firstSeen} /></h3>
                <h6>Last seen</h6>
                <h3><TimeSince date={agg.lastSeen} /></h3>
              </div>
              <div className="col-md-6">
                <h6>In release</h6>
                <h3>cd5b4c4d93ad</h3>
                <h6>Status</h6>
                <h3>{agg.status}</h3>
              </div>
            </div>
          </div>
        </div>

        {this.state.loading ?
          <LoadingIndicator />
        : (this.state.error ?
          <LoadingError onRetry={this.fetchData} />
        :
          <div>
            <MutedBox status={agg.status} />
            <AggregateEventToolbar
                aggregate={agg}
                event={evt}
                orgId={params.orgId}
                projectId={params.projectId} />
            <AggregateEvent aggregate={agg} event={evt} />
          </div>
        )}
      </div>
    );
  }
});

module.exports = AggregateOverview;
