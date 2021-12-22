import Reflux from 'reflux';

const RepositoryActions = Reflux.createActions([
  'resetRepositories',
  'loadRepositories',
  'loadRepositoriesError',
  'loadRepositoriesSuccess',
]);

export default RepositoryActions;
