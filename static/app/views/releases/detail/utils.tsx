import {Location} from 'history';
import pick from 'lodash/pick';
import moment from 'moment';

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
  ReleaseProject,
  ReleaseWithHealth,
  Repository,
} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import {decodeList} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {isProjectMobileForReleases} from 'app/views/releases/list';

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
  [ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: t('Crash Free Session Rate'),
  [ReleaseComparisonChartType.HEALTHY_SESSIONS]: t('Healthy'),
  [ReleaseComparisonChartType.ABNORMAL_SESSIONS]: t('Abnormal'),
  [ReleaseComparisonChartType.ERRORED_SESSIONS]: t('Errored'),
  [ReleaseComparisonChartType.CRASHED_SESSIONS]: t('Crashed Session Rate'),
  [ReleaseComparisonChartType.CRASH_FREE_USERS]: t('Crash Free User Rate'),
  [ReleaseComparisonChartType.HEALTHY_USERS]: t('Healthy'),
  [ReleaseComparisonChartType.ABNORMAL_USERS]: t('Abnormal'),
  [ReleaseComparisonChartType.ERRORED_USERS]: t('Errored'),
  [ReleaseComparisonChartType.CRASHED_USERS]: t('Crashed User Rate'),
  [ReleaseComparisonChartType.SESSION_COUNT]: t('Session Count'),
  [ReleaseComparisonChartType.USER_COUNT]: t('User Count'),
  [ReleaseComparisonChartType.ERROR_COUNT]: t('Error Count'),
  [ReleaseComparisonChartType.TRANSACTION_COUNT]: t('Transaction Count'),
  [ReleaseComparisonChartType.FAILURE_RATE]: t('Failure Rate'),
};

export const releaseComparisonChartTitles = {
  [ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: t('Crash Free Session Rate'),
  [ReleaseComparisonChartType.HEALTHY_SESSIONS]: t('Healthy Session Rate'),
  [ReleaseComparisonChartType.ABNORMAL_SESSIONS]: t('Abnormal Session Rate'),
  [ReleaseComparisonChartType.ERRORED_SESSIONS]: t('Errored Session Rate'),
  [ReleaseComparisonChartType.CRASHED_SESSIONS]: t('Crashed Session Rate'),
  [ReleaseComparisonChartType.CRASH_FREE_USERS]: t('Crash Free User Rate'),
  [ReleaseComparisonChartType.HEALTHY_USERS]: t('Healthy User Rate'),
  [ReleaseComparisonChartType.ABNORMAL_USERS]: t('Abnormal User Rate'),
  [ReleaseComparisonChartType.ERRORED_USERS]: t('Errored User Rate'),
  [ReleaseComparisonChartType.CRASHED_USERS]: t('Crashed User Rate'),
  [ReleaseComparisonChartType.SESSION_COUNT]: t('Session Count'),
  [ReleaseComparisonChartType.USER_COUNT]: t('User Count'),
  [ReleaseComparisonChartType.ERROR_COUNT]: t('Error Count'),
  [ReleaseComparisonChartType.TRANSACTION_COUNT]: t('Transaction Count'),
  [ReleaseComparisonChartType.FAILURE_RATE]: t('Failure Rate'),
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

type GenerateReleaseMarklineOptions = {
  hideLabel?: boolean;
  axisIndex?: number;
};

function generateReleaseMarkLine(
  title: string,
  position: number,
  theme: Theme,
  options?: GenerateReleaseMarklineOptions
) {
  const {hideLabel, axisIndex} = options || {};

  return {
    seriesName: title,
    type: 'line',
    data: [{name: position, value: null as any}], // TODO(ts): echart types
    yAxisIndex: axisIndex ?? undefined,
    xAxisIndex: axisIndex ?? undefined,
    color: theme.gray300,
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: theme.gray300, type: 'solid'},
      label: {
        position: 'insideEndBottom',
        formatter: hideLabel ? '' : title,
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

export const releaseMarkLinesLabels = {
  created: t('Release Created'),
  adopted: t('Adopted'),
  unadopted: t('Unadopted'),
};

export function generateReleaseMarkLines(
  release: ReleaseWithHealth,
  project: ReleaseProject,
  theme: Theme,
  location: Location,
  options?: GenerateReleaseMarklineOptions
) {
  const adoptionStages = release.adoptionStages?.[project.slug];
  const isDefaultPeriod = !(
    location.query.pageStart ||
    location.query.pageEnd ||
    location.query.pageStatsPeriod
  );
  const isSingleEnv = decodeList(location.query.environment).length === 1;

  if (!isDefaultPeriod) {
    // do not show marklines on non-default period
    return [];
  }

  const markLines = [
    generateReleaseMarkLine(
      releaseMarkLinesLabels.created,
      moment(release.dateCreated).startOf('minute').valueOf(),
      theme,
      options
    ),
  ];

  if (!isSingleEnv || !isProjectMobileForReleases(project.platform)) {
    // for now want to show marklines only on mobile platforms with single environment selected
    return markLines;
  }

  if (adoptionStages?.adopted) {
    markLines.push(
      generateReleaseMarkLine(
        releaseMarkLinesLabels.adopted,
        moment(adoptionStages.adopted).valueOf(),
        theme,
        options
      )
    );
  }

  if (adoptionStages?.unadopted) {
    markLines.push(
      generateReleaseMarkLine(
        releaseMarkLinesLabels.unadopted,
        moment(adoptionStages.unadopted).valueOf(),
        theme,
        options
      )
    );
  }

  return markLines;
}
