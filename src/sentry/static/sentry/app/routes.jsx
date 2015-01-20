/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;

var App = require("./components/app");
var Stream = require("./components/stream");

var routes = (
  <Route name="app" path="/" handler={App}>
    <Route name="stream" path="/:organizationId/:projectId/" handler={Stream}/>
  </Route>
);

module.exports = routes;
    // React.render(React.createFactory(Stream)({
    //   aggList: {% serialize event_list %},
    //   project: {% serialize project %},
    //   memberList: {% serialize member_list %},
    //   initialQuery: {% convert_to_json query %},
    //   pageLinks: {% convert_to_json page_links %}
    // }), document.getElementById('blk_stream'));

