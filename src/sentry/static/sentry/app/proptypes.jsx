/*** @jsx React.DOM */
var React = require("react");

var PropTypes = {
  Aggregate: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  })
};

module.exports = PropTypes;
