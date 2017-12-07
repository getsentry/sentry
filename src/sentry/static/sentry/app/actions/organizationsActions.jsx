import Reflux from 'reflux';

const OrganizationsActions = Reflux.createActions([
  'setActive',
  'remove',
  'removeSuccess',
  'removeError',
]);

export default OrganizationsActions;
