import OrganizationStore from "../stores/organizationStore";

var AppState = {
  getOrganizationList() {
    return OrganizationStore.getAll();
  }
};

export default AppState;
