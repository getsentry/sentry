/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;

var App = require("./components/app");
var Aggregate = require("./components/aggregate");
var ProjectDetails = require("./components/projectDetails");
var Stream = require("./components/stream");

var routes = (
  <Route name="app" path="/" handler={App}>
    <Route name="projectDetails" path="/:orgId/:projectId/" handler={ProjectDetails}>
      <DefaultRoute name="stream" handler={Stream} />
      <Route name="aggregateDetails" path="group/:aggregateId/" handler={Aggregate}/>
    </Route>
  </Route>
);

module.exports = routes;
