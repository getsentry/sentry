import ReleaseActions from 'app/actions/releaseActions';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {Client} from 'app/api';

/**
 * Fetch a subset of releases for an organization or project. To fetch releases
 * from multiple projects, leave `projectId` as undefined.
 *
 * TODO(leedongwei): Replace `any` types.
 */
export function fetchReleases(
  api: Client,
  orgId: string,
  project?: string,
  releaseVersion?: string,
  pageSize?: number
): Promise<any> {
  const url = `/organizations/${orgId}/releases/`;
  const query: {
    [key: string]: string | number;
  } = {};

  if (project) {
    query.project = project;
  }

  if (releaseVersion) {
    query.query = releaseVersion;
  }

  if (pageSize) {
    query.per_page = pageSize;
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
