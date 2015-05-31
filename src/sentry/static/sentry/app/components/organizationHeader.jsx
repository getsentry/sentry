/*** @jsx React.DOM */

var React = require("react");

var Breadcrumbs = require("./breadcrumbs");
var Header = require("../components/header");

var OrganizationHeader = React.createClass({
  render() {
    return (
      <div>
        <Header />
        <div className="sub-header">
          <div className="container">
            <Breadcrumbs />
           </div>
        </div>
      </div>
    );
  }
});

module.exports = OrganizationHeader;
