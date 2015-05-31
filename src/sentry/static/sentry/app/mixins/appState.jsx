/*** @jsx React.DOM */

var React = require("react");

var OrganizationStore = require("../stores/organizationStore");
var PropTypes = require("../proptypes");

var AppState = {
  getOrganizationList() {
    return OrganizationStore.getAll();
  }
};

module.exports = AppState;
