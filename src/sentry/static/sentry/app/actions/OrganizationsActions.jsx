import Reflux from 'reflux';

const OrganizationsActions = Reflux.createActions([
  'update',
  'setActive',
  'changeSlug',
  'remove',
  'removeSuccess',
  'removeError',
]);

export default OrganizationsActions;
