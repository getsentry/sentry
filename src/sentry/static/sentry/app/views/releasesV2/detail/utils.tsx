import {Client} from 'app/api';
import {CommitFile} from 'app/types';

export const deleteRelease = (orgId: string, version: string) => {
  const api = new Client();

  return api.requestPromise(
    `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`,
    {
      method: 'DELETE',
    }
  );
};

/**
 * Convert list of individual file changes into a per-file summary grouped by repository
 */
export function getFilesByRepository(fileList: CommitFile[]) {
  return fileList.reduce((filesByRepository, file) => {
    const {filename, repoName, author, type} = file;

    if (!filesByRepository.hasOwnProperty(repoName)) {
      filesByRepository[repoName] = {};
    }

    if (!filesByRepository[repoName].hasOwnProperty(filename)) {
      filesByRepository[repoName][filename] = {
        authors: {},
        types: new Set(),
      };
    }

    filesByRepository[repoName][filename].authors[author.email] = author;
    filesByRepository[repoName][filename].types.add(type);

    return filesByRepository;
  }, {});
}
