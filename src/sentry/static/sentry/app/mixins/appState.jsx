import OrganizationsStore from 'app/stores/organizationsStore';

let AppState = {
  getOrganizationList() {
    return OrganizationsStore.getAll();
  },
};

export default AppState;
