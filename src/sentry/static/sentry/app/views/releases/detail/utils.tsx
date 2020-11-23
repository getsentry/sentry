import {Location} from 'history';
import pick from 'lodash/pick';

import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import {
  Commit,
  CommitFile,
  FilesByRepository,
  GlobalSelection,
  LightWeightOrganization,
  Repository,
} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';

export type CommitsByRepository = {
  [key: string]: Commit[];
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

/**
 * Get request query according to the url params and active repository
 */

type GetQueryProps = {
  location: Location;
  perPage?: number;
  activeRepository?: Repository;
};

export function getQuery({location, perPage = 40, activeRepository}: GetQueryProps) {
  const query = {
    ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
    per_page: perPage,
  };

  if (!activeRepository) {
    return query;
  }

  return {...query, repo_name: activeRepository.name};
}

/**
 * Get repositories to render according to the activeRepository
 */
export function getReposToRender(repos: Array<string>, activeRepository?: Repository) {
  if (!activeRepository) {
    return repos;
  }
  return [activeRepository.name];
}

/**
 * Get high level transaction information for this release
 */
export function getReleaseEventView(
  selection: GlobalSelection,
  version: string,
  organization: LightWeightOrganization
): EventView {
  const {projects, environments, datetime} = selection;
  const {start, end, period} = datetime;

  const discoverQuery = {
    id: undefined,
    version: 2,
    name: `${t('Release Apdex')}`,
    fields: [`apdex(${organization.apdexThreshold})`],
    query: stringifyQueryObject(
      new QueryResults([`release:${version}`, 'event.type:transaction', 'count():>0'])
    ),
    range: period,
    environment: environments,
    projects,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
  } as const;

  return EventView.fromSavedQuery(discoverQuery);
}
