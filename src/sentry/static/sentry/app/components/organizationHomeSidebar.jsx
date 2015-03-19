/*** @jsx React.DOM */

var React = require("react");

var ListLink = require("../components/listLink");
var OrganizationState = require("../mixins/organizationState");

var OrganizationHomeSidebar = React.createClass({
  mixins: [OrganizationState],

  componentWillMount() {
    // Handle out of scope classes with jQuery
    jQuery(document.body).addClass("show-rightbar");
  },

  componentWillUnmount() {
    // Handle out of scope classes with jQuery
    jQuery(document.body).removeClass("show-rightbar");
  },

  render() {
    var org = this.getOrganization();
    var orgParams = {orgId: org.slug};

    return (
      <div className="rightbar">
        <ul className="nav nav-stacked">
          <ListLink to="organizationTeams" params={orgParams}>Teams</ListLink>
          <ListLink to="organizationMembers" params={orgParams}>Members</ListLink>
        </ul>
      </div>
    );
  }
});

module.exports = OrganizationHomeSidebar;
