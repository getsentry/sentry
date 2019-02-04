import OrganizationsStore from 'app/stores/organizationsStore';

const AppState = {
  getOrganizationList() {
    return OrganizationsStore.getAll();
  },
};

export default AppState;
