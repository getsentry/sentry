/*** @jsx React.DOM */

var React = require("react");

var AggregateEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");

var ExceptionInterface = React.createClass({
  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired,
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired
  },

  render: function(){
    var agg = this.props.aggregate;
    var evt = this.props.event;
    var data = this.props.data;

    var children = [];
    data.values.forEach(function(exc, excIdx){
      // TODO(dcramer): This is basically completely wrong rendering atm

      var frames = [];
      exc.stacktrace.frames.forEach(function(frame){
      });

      children.push(
        <div className="traceback" key={"exc-" + excIdx}>
          <h3>
            <span>{exc.type}</span>
          </h3>
          {exc.value &&
            <pre>{exc.value}</pre>
          }
          {frames}
        </div>
      );
    });

    return (
      <AggregateEventDataSection
          aggregate={agg}
          event={evt}
          title="Exception">
        {children}
      </AggregateEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
