import {Client} from 'app/api';
import {CommitFile, Commit, FilesByRepository} from 'app/types';
import {t} from 'app/locale';

export type CommitsByRepository = {
  [key: string]: Commit[];
};

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
  return fileList.reduce<FilesByRepository>((filesByRepository, file) => {
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

    if (author.email) {
      filesByRepository[repoName][filename].authors[author.email] = author;
    }

    filesByRepository[repoName][filename].types.add(type);

    return filesByRepository;
  }, {});
}

/**
 * Convert list of individual commits into a summary grouped by repository
 */
export function getCommitsByRepository(commitList: Commit[]): CommitsByRepository {
  return commitList.reduce((commitsByRepository, commit) => {
    const repositoryName = commit.repository?.name ?? t('unknown');

    if (!commitsByRepository.hasOwnProperty(repositoryName)) {
      commitsByRepository[repositoryName] = [];
    }

    commitsByRepository[repositoryName].push(commit);

    return commitsByRepository;
  }, {});
}
