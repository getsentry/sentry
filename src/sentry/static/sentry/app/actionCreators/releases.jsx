// import ReleaseStore from 'app/stores/releaseStore';
import ReleaseActions from 'app/actions/releaseActions';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

/**
 * Fetch a subset of releases for an organization or project.
 *
 * @param {Object} api API client
 * @param {String} orgId Organization slug
 * @param {String} projectId Index of the project inside Organization object
 * @param {String} releaseVersion Partial or complete string of the release version
 * @param {Number} limit Number of results to return
 */
export function fetchReleases(
  api,
  orgId,
  projectId = null,
  releaseVersion = '',
  limit = ''
) {
  const url = `/organizations/${orgId}/releases/`;
  const query = {};

  if (projectId) {
    query.project = projectId;
  }

  if (releaseVersion) {
    query.query = releaseVersion;
  }

  if (limit) {
    query.limit = limit;
  }

  ReleaseActions.fetchReleases();

  const promise = api
    .requestPromise(url, {
      method: 'GET',
      query,
    })
    .then(resp => {
      ReleaseActions.fetchReleasesSuccess(resp);
      return resp;
    })
    .catch(err => {
      ReleaseActions.fetchReleasesError(err);
      addErrorMessage(t('Unable to fetch releases'));
    });

  return promise;
}
