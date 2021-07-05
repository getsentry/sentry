import {Location} from 'history';
import pick from 'lodash/pick';

import MarkLine from 'app/components/charts/components/markLine';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import {
  Commit,
  CommitFile,
  FilesByRepository,
  GlobalSelection,
  LightWeightOrganization,
  ReleaseComparisonChartType,
  Repository,
} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {Theme} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';

import {commonTermsDescription, SessionTerm} from '../utils/sessionTerm';

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

  const apdexField = organization.features.includes('project-transaction-threshold')
    ? 'apdex()'
    : `apdex(${organization.apdexThreshold})`;

  const discoverQuery = {
    id: undefined,
    version: 2,
    name: `${t('Release Apdex')}`,
    fields: [apdexField],
    query: new QueryResults([
      `release:${version}`,
      'event.type:transaction',
      'count():>0',
    ]).formatString(),
    range: period,
    environment: environments,
    projects,
    start: start ? getUtcDateString(start) : undefined,
    end: end ? getUtcDateString(end) : undefined,
  } as const;

  return EventView.fromSavedQuery(discoverQuery);
}

export const releaseComparisonChartLabels = {
  [ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: t('Crash Free Sessions'),
  [ReleaseComparisonChartType.CRASH_FREE_USERS]: t('Crash Free Users'),
  [ReleaseComparisonChartType.SESSION_COUNT]: t('Session Count'),
  [ReleaseComparisonChartType.USER_COUNT]: t('User Count'),
};

export const releaseComparisonChartHelp = {
  [ReleaseComparisonChartType.CRASH_FREE_SESSIONS]:
    commonTermsDescription[SessionTerm.CRASH_FREE_SESSIONS],
  [ReleaseComparisonChartType.CRASH_FREE_USERS]:
    commonTermsDescription[SessionTerm.CRASH_FREE_USERS],
  [ReleaseComparisonChartType.SESSION_COUNT]: t(
    'The number of sessions in a given period.'
  ),
  [ReleaseComparisonChartType.USER_COUNT]: t('The number of users in a given period.'),
};

export function generateReleaseMarkLine(title: string, position: number, theme: Theme) {
  return {
    seriesName: title,
    type: 'line',
    data: [],
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: theme.gray300, type: 'solid'},
      label: {
        position: 'insideEndBottom',
        formatter: title,
        font: 'Rubik',
        fontSize: 11,
      } as any, // TODO(ts): weird echart types,
      data: [
        {
          xAxis: position,
        },
      ] as any, // TODO(ts): weird echart types
    }),
  };
}
