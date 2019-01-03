import {Client} from 'app/api';

/**
 * Delete release version
 *
 * @param {String} orgId Organization slug
 * @param {String} version Version
 * @returns {Promise}
 */
export function deleteRelease(orgId, version) {
  const api = new Client();

  return api.requestPromise(
    `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`,
    {
      method: 'DELETE',
    }
  );
}
