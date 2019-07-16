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

/**
 * Convert list of individual file changes into a per-file summary grouped by repository
 *
 * @param {Array<File>} fileList List of files
 * @returns {Object} Object grouped by repository and file name
 */
export function getFilesByRepository(fileList) {
  return fileList.reduce(function(fbr, file) {
    const {filename, repoName, author, type} = file;
    if (!fbr.hasOwnProperty(repoName)) {
      fbr[repoName] = {};
    }
    if (!fbr[repoName].hasOwnProperty(filename)) {
      fbr[repoName][filename] = {
        authors: {},
        types: new Set(),
        repos: new Set(),
      };
    }

    fbr[repoName][filename].authors[author.email] = author;
    fbr[repoName][filename].types.add(type);

    return fbr;
  }, {});
}
