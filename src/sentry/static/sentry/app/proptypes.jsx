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
  }),
  Project: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Team: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  User: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  })
};

module.exports = PropTypes;
