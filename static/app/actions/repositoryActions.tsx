import {createActions} from 'reflux';

const RepositoryActions = createActions([
  'resetRepositories',
  'loadRepositories',
  'loadRepositoriesError',
  'loadRepositoriesSuccess',
]);

export default RepositoryActions;
