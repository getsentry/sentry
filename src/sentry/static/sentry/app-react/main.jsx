/*** @jsx React.DOM */
var React = require("react");
var Router = require("react-router");
var $ = require("jquery");

var Route = Router.Route;
var NotFoundRoute = Router.NotFoundRoute;
var DefaultRoute = Router.DefaultRoute;
var Link = Router.Link;
var RouteHandler = Router.RouteHandler;

var App = React.createClass({
  render: function() {
    return (
      <div>
        Hello World!
        <RouteHandler/>
      </div>
    );
  }
});

var Example = React.createClass({
  render: function() {
    return (
      <div>
        Test
      </div>
    );
  }
});

var routes = (
  <Route handler={App}>
    <Route name="example" handler={Example}/>
    <DefaultRoute handler={Example}/>
  </Route>
);

$(function(){
  Router.run(routes, function (Handler) {
    React.render(<Handler/>, document.body);
  });
});
