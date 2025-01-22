import type {Theme} from '@emotion/react';
import type {Location} from 'history';
import pick from 'lodash/pick';
import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';

import MarkLine from 'sentry/components/charts/components/markLine';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {
  Commit,
  CommitFile,
  FilesByRepository,
  Repository,
} from 'sentry/types/integrations';
import type {ReleaseProject, ReleaseWithHealth} from 'sentry/types/release';
import {ReleaseComparisonChartType} from 'sentry/types/release';
import {decodeList} from 'sentry/utils/queryString';

import {getReleaseBounds, getReleaseParams, isMobileRelease} from '../utils';
import {commonTermsDescription, SessionTerm} from '../utils/sessionTerm';

type CommitsByRepository = Record<string, Commit[]>;

/**
 * Convert list of individual file changes into a per-file summary grouped by repository
 */
export function getFilesByRepository(fileList: CommitFile[]) {
  return fileList.reduce<FilesByRepository>((filesByRepository, file) => {
    const {filename, repoName, author, type} = file;

    if (!filesByRepository.hasOwnProperty(repoName)) {
      filesByRepository[repoName] = {};
    }

    if (!filesByRepository[repoName]!.hasOwnProperty(filename)) {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      filesByRepository[repoName]![filename] = {
        authors: {},
        types: new Set(),
      };
    }

    if (author.email) {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      filesByRepository[repoName]![filename].authors[author.email] = author;
    }

    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    filesByRepository[repoName]![filename].types.add(type);

    return filesByRepository;
  }, {});
}

/**
 * Convert list of individual commits into a summary grouped by repository
 */
export function getCommitsByRepository(commitList: Commit[]): CommitsByRepository {
  return commitList.reduce<CommitsByRepository>((commitsByRepository, commit) => {
    const repositoryName = commit.repository?.name ?? t('unknown');

    if (!commitsByRepository.hasOwnProperty(repositoryName)) {
      commitsByRepository[repositoryName] = [];
    }

    commitsByRepository[repositoryName]!.push(commit);

    return commitsByRepository;
  }, {});
}

/**
 * Get request query according to the url params and active repository
 */

type GetQueryProps = {
  location: Location;
  activeRepository?: Repository;
  perPage?: number;
};

export function getQuery({location, perPage = 40, activeRepository}: GetQueryProps) {
  const query = {
    ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
    per_page: perPage,
  };

  if (!activeRepository) {
    return query;
  }

  return {
    ...query,
    repo_id: activeRepository.externalId,
    repo_name: activeRepository.name,
  };
}

/**
 * Get repositories to render according to the activeRepository
 */
export function getReposToRender(repos: string[], activeRepository?: Repository) {
  if (!activeRepository) {
    return repos;
  }
  return [activeRepository.name];
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

export const releaseComparisonChartHelp: Partial<
  Record<ReleaseComparisonChartType, string>
> = {
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
  axisIndex?: number;
  hideLabel?: boolean;
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
        // @ts-ignore TS(2322): Type '{ position: "insideEndBottom"; formatter: st... Remove this comment to see the full error message
        font: 'Rubik',
        fontSize: 14,
        color: theme.chartLabel,
        backgroundColor: theme.chartOther,
      },
      data: [
        {
          xAxis: position,
        },
      ],
    }),
  };
}

export const releaseMarkLinesLabels = {
  created: t('Release Created'),
  adopted: t('Adopted'),
  unadopted: t('Replaced'),
};

export function generateReleaseMarkLines(
  release: ReleaseWithHealth,
  project: ReleaseProject,
  theme: Theme,
  location: Location,
  options?: GenerateReleaseMarklineOptions
) {
  const markLines: Series[] = [];
  const adoptionStages = release.adoptionStages?.[project.slug];
  const isSingleEnv = decodeList(location.query.environment).length === 1;
  const releaseBounds = getReleaseBounds(release);
  const {statsPeriod, ...releaseParamsRest} = getReleaseParams({
    location,
    releaseBounds,
  });
  let {start, end} = releaseParamsRest;
  const isDefaultPeriod = !(
    location.query.pageStart ||
    location.query.pageEnd ||
    location.query.pageStatsPeriod
  );

  if (statsPeriod) {
    const parsedStatsPeriod = parseStatsPeriod(statsPeriod, null);
    start = parsedStatsPeriod.start;
    end = parsedStatsPeriod.end;
  }

  const releaseCreated = moment(release.dateCreated).startOf('minute');
  if (
    releaseCreated.isBetween(start, end) ||
    (isDefaultPeriod && releaseBounds.type === 'normal')
  ) {
    markLines.push(
      generateReleaseMarkLine(
        releaseMarkLinesLabels.created,
        releaseCreated.valueOf(),
        theme,
        options
      )
    );
  }

  if (!isSingleEnv || !isMobileRelease(project.platform)) {
    // for now want to show marklines only on mobile platforms with single environment selected
    return markLines;
  }

  const releaseAdopted: Moment | undefined = adoptionStages?.adopted
    ? moment(adoptionStages.adopted)
    : undefined;
  if (releaseAdopted?.isBetween(start, end)) {
    markLines.push(
      generateReleaseMarkLine(
        releaseMarkLinesLabels.adopted,
        releaseAdopted.valueOf(),
        theme,
        options
      )
    );
  }

  const releaseReplaced: Moment | undefined = adoptionStages?.unadopted
    ? moment(adoptionStages.unadopted)
    : undefined;
  if (releaseReplaced?.isBetween(start, end)) {
    markLines.push(
      generateReleaseMarkLine(
        releaseMarkLinesLabels.unadopted,
        releaseReplaced.valueOf(),
        theme,
        options
      )
    );
  }

  return markLines;
}
