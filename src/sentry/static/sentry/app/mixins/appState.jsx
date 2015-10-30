import OrganizationStore from '../stores/organizationStore';

let AppState = {
  getOrganizationList() {
    return OrganizationStore.getAll();
  }
};

export default AppState;
