import Reflux from 'reflux';

const ReleaseActions = Reflux.createActions([
  'loadRelease', // Singular as it loads 1 release
  'loadReleaseError',
  'loadReleaseSuccess',
  'loadDeploys', // Plural as it loads all deploys related to a release
  'loadDeploysError',
  'loadDeploysSuccess',
]);

export default ReleaseActions;
