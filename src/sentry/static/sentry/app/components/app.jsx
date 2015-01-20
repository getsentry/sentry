/*** @jsx React.DOM */

var React = require("react");
var Router = require('react-router');

var App = React.createClass({
  render: function () {
    return (
      <Router.RouteHandler {...this.props.params}/>
    );
  }
});

module.exports = App;
