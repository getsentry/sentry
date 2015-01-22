/*** @jsx React.DOM */
var React = require("react");
var Router = require("react-router");

var AssigneeSelector = require("../assigneeSelector");
var BarChart = require("../barChart");
var Count = require("../count");
var TimeSince = require("../timeSince");

var StreamAggregate = React.createClass({
  mixins: [Router.State],

  propTypes: {
    data: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    onSelect: React.PropTypes.func.isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
    isSelected: React.PropTypes.bool
  },
  render: function() {
    var data = this.props.data,
        userCount = 0;

    var params = this.getParams();

    var chartData = data.stats[this.props.statsPeriod].map(function(point){
      return {x: point[0], y: point[1]};
    });

    if (data.tags["sentry:user"] !== undefined) {
      userCount = data.tags["sentry:user"].count;
    }

    var className = "group";
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
        <div className="event-details event-cell">
          <div className="checkbox">
            <input type="checkbox" className="chk-select" value={data.id}
                   checked={this.props.isSelected}
                   onChange={this.props.onSelect} />
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
        <div className="event-assignee event-cell hidden-xs hidden-sm">
          <AssigneeSelector
            aggregate={data}
            memberList={this.props.memberList} />
        </div>
        <div className="hidden-sm hidden-xs event-graph align-right event-cell">
          <BarChart points={chartData} className="sparkline" />
        </div>
        <div className="hidden-xs event-occurrences align-center event-cell">
          <Count value={data.count} />
        </div>
        <div className="hidden-xs event-users align-center event-cell">
          <Count value={userCount} />
        </div>
      </li>
    );
  }
});

module.exports = StreamAggregate;
