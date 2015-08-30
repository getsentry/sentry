import React from "react";

import MenuItem from "../menuItem";
import DropdownLink from "../dropdownLink";
import AppState from "../../mixins/appState"
import OrganizationStore from "../../stores/organizationStore";
import ConfigStore from "../../stores/configStore";

var OrganizationSelector = React.createClass({
  mixins: [
    AppState,
  ],

  shouldComponentUpdate(nextProps, nextState) {
    return (nextProps.organization || {}).id !== (this.props.organization || {}).id;
  },

  render() {
    var singleOrganization = ConfigStore.get('singleOrganization');
    var activeOrg = this.props.organization;

    if (singleOrganization || !activeOrg) {
      return null;
    }

    var urlPrefix = ConfigStore.get('urlPrefix');
    var features = ConfigStore.get('features');

    return (
      <DropdownLink
          menuClasses="dropdown-menu-right"
          topLevelClasses={(this.props.className || "") + " org-selector"}
          title={activeOrg.name}>
        {OrganizationStore.getAll().map((org) => {
          return (
            <MenuItem key={org.slug} to="organizationDetails" params={{orgId: org.slug}}
                      isActive={activeOrg.id === org.id}>
              {org.name}
            </MenuItem>
          );
        })}
        {features.has('organizations:create') &&
          <MenuItem divider={true} />
        }
        {features.has('organizations:create') &&
          <MenuItem href={urlPrefix + '/organizations/new/'}>New Organization</MenuItem>
        }
      </DropdownLink>
    );
  }
});

export default OrganizationSelector;
