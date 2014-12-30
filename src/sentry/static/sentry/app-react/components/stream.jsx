/*** @jsx React.DOM */
var React = require("react");

var StreamActions = require("./streamActions")

var Stream = React.createClass({
  render: function() {
    return (
      <div class="group-header-container" data-spy="affix" data-offset-top="134">
        <div class="container">
          <div class="group-header">
            <StreamActions/>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = Stream;
