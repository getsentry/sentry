/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var AssigneeSelector = require("../../components/assigneeSelector");
var BarChart = require("../../components/barChart");
var Count = require("../../components/count");
var SelectedAggregateStore = require("../../stores/selectedAggregateStore");
var TimeSince = require("../../components/timeSince");

var StreamAggregate = React.createClass({
  mixins: [
    Reflux.listenTo(SelectedAggregateStore, "onSelectedAggregateChange"),
    Router.State
  ],

  propTypes: {
    data: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
  },

  getInitialState() {
    return {
      isSelected: false,
    };
  },

  onSelectedAggregateChange() {
    var id = this.getParams().aggregateId;
    this.setState({
      isSelected: SelectedAggregateStore.isSelected(id),
    });
  },

  onSelect() {
    var id = this.getParams().aggregateId;
    SelectedAggregateStore.toggleSelect(id);
  },

  render() {
    var data = this.props.data,
        userCount = 0;

    var params = this.getParams();

    var chartData = data.stats[this.props.statsPeriod].map(function(point){
      return {x: point[0], y: point[1]};
    });

    if (data.tags["sentry:user"] !== undefined) {
      userCount = data.tags["sentry:user"].count;
    }

    var className = "group row";
    if (data.isBookmarked) {
      className += " isBookmarked";
    }
    if (data.hasSeen) {
      className += " hasSeen";
    }
    if (data.status === "resolved") {
      className += " isResolved";
    }

    return (
      <li className={className}>
        <div className="col-md-7 event-details">
          <div className="checkbox">
            <input type="checkbox" className="chk-select" value={data.id}
                   checked={this.state.isSelected}
                   onChange={this.onSelect} />
          </div>
          <h3>
            <Router.Link to="aggregateDetails"
                  params={{orgId: params.orgId, projectId: params.projectId, aggregateId: data.id}}>
              <span className="icon icon-bookmark"></span>
              {data.title}
            </Router.Link>
          </h3>
          <div className="event-message">
            <span className="message">{data.culprit}</span>
          </div>
          <div className="event-meta">
            <span className="last-seen"><TimeSince date={data.lastSeen} /></span>
            &nbsp;&mdash;&nbsp;
            <span className="first-seen">from <TimeSince date={data.firstSeen} /></span>
          </div>
        </div>
        <div className="event-assignee col-md-1 hidden-xs hidden-sm">
          <AssigneeSelector
            aggregate={data}
            memberList={this.props.memberList} />
        </div>
        <div className="col-md-2 hidden-sm hidden-xs event-graph align-right">
          <BarChart points={chartData} className="sparkline" />
        </div>
        <div className="col-md-1 hidden-xs event-occurrences align-right">
          <Count value={data.count} />
        </div>
        <div className="col-md-1 hidden-xs event-users align-right">
          <Count value={userCount} />
        </div>
      </li>
    );
  }
});

module.exports = StreamAggregate;
