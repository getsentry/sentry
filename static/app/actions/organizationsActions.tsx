import {createActions} from 'reflux';

const OrganizationsActions = createActions([
  'update',
  'setActive',
  'changeSlug',
  'remove',
  'removeSuccess',
  'removeError',
]);

export default OrganizationsActions;
