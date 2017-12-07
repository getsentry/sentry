import OrganizationsStore from '../stores/organizationsStore';

let AppState = {
  getOrganizationList() {
    return OrganizationsStore.getAll();
  },
};

export default AppState;
