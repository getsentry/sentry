import Reflux from 'reflux';

const OrganizationsActions = Reflux.createActions([
  'setActive',
  'changeSlug',
  'remove',
  'removeSuccess',
  'removeError',
]);

export default OrganizationsActions;
