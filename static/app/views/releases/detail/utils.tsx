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
  PerformanceCardType,
  ReleaseComparisonChartType,
  ReleaseWithHealth,
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

export const performanceCardLabels = {
  [PerformanceCardType.USER_MISERY]: t('User Misery'),
  [PerformanceCardType.APDEX]: t('Apdex'),
  [PerformanceCardType.WEB_VITALS]: t('Web Vitals'),
  [PerformanceCardType.FIRST_CONTENTFUL_PAINT]: t('First Contentful Paint (FCP)'),
  [PerformanceCardType.FIRST_INPUT_DELAY]: t('First Input Delay (FID)'),
  [PerformanceCardType.LARGEST_CONTENTFUL_PAINT]: t('Largest Contentful Paint (LCP)'),
  [PerformanceCardType.CUMULATIVE_LAYOUT_SHIFT]: t('Cumulative Layout Shift (CLS)'),
  [PerformanceCardType.SPAN_OPERATIONS]: t('Span Operations'),
  [PerformanceCardType.HTTP]: t('HTTP'),
  [PerformanceCardType.DB]: t('DB'),
  [PerformanceCardType.BROWSER]: t('Browser'),
  [PerformanceCardType.RESOURCE]: t('Resource'),
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
    data: [],
    yAxisIndex: axisIndex ?? undefined,
    xAxisIndex: axisIndex ?? undefined,
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

export function generateReleaseMarkLines(
  release: ReleaseWithHealth,
  projectSlug: string,
  theme: Theme,
  options?: GenerateReleaseMarklineOptions
) {
  const adoptionStages = release.adoptionStages?.[projectSlug];

  const markLines = [
    generateReleaseMarkLine(
      t('Release Created'),
      moment(release.dateCreated).valueOf(),
      theme,
      options
    ),
  ];

  if (adoptionStages?.adopted) {
    markLines.push(
      generateReleaseMarkLine(
        t('Adopted'),
        moment(adoptionStages.adopted).valueOf(),
        theme,
        options
      )
    );
  }

  if (adoptionStages?.unadopted) {
    markLines.push(
      generateReleaseMarkLine(
        t('Unadopted'),
        moment(adoptionStages.unadopted).valueOf(),
        theme,
        options
      )
    );
  }

  return markLines;
}
