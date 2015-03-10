/*** @jsx React.DOM */

var React = require("react");

var ListLink = require("../components/listLink");
var OrganizationState = require("../mixins/organizationState");

var OrganizationHomeSidebar = React.createClass({
  mixins: [OrganizationState],

  render() {
    var org = this.getOrganization();
    var orgParams = {orgId: org.slug};

    return (
      <ul className="nav nav-stacked">
        <ListLink to="organizationTeams" params={orgParams}>Teams</ListLink>
        <ListLink to="organizationMembers" params={orgParams}>Members</ListLink>
      </ul>
    );
  }
});

module.exports = OrganizationHomeSidebar;
