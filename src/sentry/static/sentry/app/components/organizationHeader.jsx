/*** @jsx React.DOM */

var React = require("react");

var Breadcrumbs = require("./breadcrumbs");

var OrganizationHeader = React.createClass({
  shouldComponentUpdate(nextProps, nextState) {
    return false;
  },

  render() {
    return (
      <div>
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
