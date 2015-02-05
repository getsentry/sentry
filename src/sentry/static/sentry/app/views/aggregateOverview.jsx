/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var AggregateActivity = require("./aggregate/activity");
var AggregateChart = require("./aggregate/chart");
var AggregateEvent = require("./aggregate/event");
var PropTypes = require("../proptypes");
var TimeSince = require("../components/timeSince");

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
      event: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var eventId = this.getParams().eventId || 'latest';

    this.setState({eventIsLoading: true});

    api.request('/groups/' + this.props.aggregate.id + '/events/' + eventId + '/', {
      success: (data) => {
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
        <div className="event-toolbar">
          <div className="pull-right">
            <div className="btn-group">
              <a href="#" className="btn btn-default btn-lg">Newer</a>
              <a href="#" className="btn btn-default btn-lg">Older</a>
            </div>
          </div>
          <ul className="nav nav-tabs">
            <li className="active"><a href="#">Tags</a></li>
            <li><a href="#">Exception</a></li>
            <li><a href="#">Request</a></li>
            <li><a href="#">Additional Data</a></li>
          </ul>
        </div>
        {agg.status === 'muted' &&
          <div className="alert alert-info">
            This event has been muted. You will not be notified of any changes and it will not show up in the default feed.
          </div>
        }
        {this.state.loading ?
          <div className="loading">Loading event data..</div>
        : (this.state.error ?
          <div className="alert alert-error alert-block">
            <p>There was an error loading data. <a onClick={this.fetchData}>Retry</a></p>
          </div>
        :
          <AggregateEvent
              aggregate={agg}
              event={this.state.event} />
        )}
      </div>
    );
  }
});

module.exports = AggregateOverview;
