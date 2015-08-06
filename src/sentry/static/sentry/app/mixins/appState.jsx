import React from "react";
import OrganizationStore from "../stores/organizationStore";
import PropTypes from "../proptypes";

var AppState = {
  getOrganizationList() {
    return OrganizationStore.getAll();
  }
};

export default AppState;

