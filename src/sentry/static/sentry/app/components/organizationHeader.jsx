var React = require("react");

var OrganizationState = require("../mixins/organizationState");

var OrganizationHeader = React.createClass({
  mixins: [OrganizationState],

  shouldComponentUpdate(nextProps, nextState) {
    return false;
  },

  render() {
    var org = this.getOrganization();
    return (
      <div className="sub-header">
        <div className="container">
          <ul className="breadcrumb">
            <li>
              <Router.Link to="organizationDetails"
                           params={{orgId: org.slug}}>
                {org.name}
              </Router.Link>
            </li>
          </ul>
        </div>
      </div>
    );
  }
});

module.exports = OrganizationHeader;
