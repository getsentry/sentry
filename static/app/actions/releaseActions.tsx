import {createActions} from 'reflux';

const ReleaseActions = createActions([
  'loadRelease', // Singular as it loads 1 release
  'loadReleaseError',
  'loadReleaseSuccess',
  'loadDeploys', // Plural as it loads all deploys related to a release
  'loadDeploysError',
  'loadDeploysSuccess',
]);

export default ReleaseActions;
