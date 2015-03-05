/*** @jsx React.DOM */

var React = require("react");

var PropTypes = require("../proptypes");

var AppState = {
  contextTypes: {
    organizationList: React.PropTypes.arrayOf(PropTypes.Organization).isRequired,
  },

  getOrganizationList() {
    return this.context.organizationList;
  }
};

module.exports = AppState;
