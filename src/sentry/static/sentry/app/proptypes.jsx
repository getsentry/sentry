/*** @jsx React.DOM */
var React = require("react");

var PropTypes = {
  AnyModel: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Aggregate: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Event: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  })
};

module.exports = PropTypes;
