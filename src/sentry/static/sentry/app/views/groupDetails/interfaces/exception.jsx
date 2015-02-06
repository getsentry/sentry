/*** @jsx React.DOM */

var React = require("react");

var GroupEventDataSection = require("../eventDataSection");
var PropTypes = require("../../../proptypes");

var ExceptionInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired
  },

  render: function(){
    var group = this.props.group;
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
      <GroupEventDataSection
          group={group}
          event={evt}
          title="Exception">
        {children}
      </GroupEventDataSection>
    );
  }
});

module.exports = ExceptionInterface;
