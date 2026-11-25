import {useQueries} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ALL_RESULTS,
  CLASSIFIER_LIST_STATS_INTERVAL,
  CLASSIFIER_LIST_STATS_PERIOD,
  Referrer,
} from 'sentry/views/classifiers/constants';
import {getClassifierOutput} from 'sentry/views/classifiers/output';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getHasResultQuery, getResultField} from 'sentry/views/classifiers/utils';
import type {TimeSeriesItem} from 'sentry/views/dashboards/widgets/common/types';

export interface ClassifierListStats {
  classified: number;
  hasMatches: boolean;
  matches: number;
  series: TimeSeriesItem[];
}

export interface ClassifierListStatsResult {
  data: ClassifierListStats | undefined;
  isError: boolean;
  isPending: boolean;
}

function getCountField(classifier: TelemetryClassifier) {
  return `count(${getResultField(classifier.resultAttribute)})`;
}

function hasMatchFilter(classifier: TelemetryClassifier) {
  return getClassifierOutput(classifier).defaultFilter !== ALL_RESULTS;
}

function getMatchQuery(classifier: TelemetryClassifier) {
  const output = getClassifierOutput(classifier);
  return output.getResultQuery(classifier, output.defaultFilter);
}

function sumValues(values: TimeSeriesItem[]) {
  return values.reduce((total, item) => total + (item.value ?? 0), 0);
}

export function useClassifierListStats(classifiers: TelemetryClassifier[]) {
  const organization = useOrganization();
  const classifiersByProject = [
    ...Map.groupBy(classifiers, classifier => classifier.projectId),
  ];
  const filteredClassifiersByProject = classifiersByProject
    .map(
      ([projectId, projectClassifiers]) =>
        [projectId, projectClassifiers.filter(hasMatchFilter)] as const
    )
    .filter(([, projectClassifiers]) => projectClassifiers.length > 0);

  const getOptions = (
    projectId: string,
    projectClassifiers: TelemetryClassifier[],
    queries: string[],
    referrer: Referrer
  ) =>
    apiOptions.as<EventsTimeSeriesResponse>()(
      '/organizations/$organizationIdOrSlug/events-timeseries/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
          yAxis: [...new Set(projectClassifiers.map(getCountField))],
          query: Array.from(new Set(queries), query => `(${query})`).join(' OR '),
          project: [Number(projectId)],
          statsPeriod: CLASSIFIER_LIST_STATS_PERIOD,
          interval: CLASSIFIER_LIST_STATS_INTERVAL,
          partial: 1,
          referrer,
        },
        staleTime: 60_000,
      }
    );

  const classifiedResults = useQueries({
    queries: classifiersByProject.map(([projectId, projectClassifiers]) =>
      getOptions(
        projectId,
        projectClassifiers,
        projectClassifiers.map(classifier =>
          getHasResultQuery(classifier.resultAttribute)
        ),
        Referrer.LIST_CLASSIFIED
      )
    ),
  });
  const matchesResults = useQueries({
    queries: filteredClassifiersByProject.map(([projectId, projectClassifiers]) =>
      getOptions(
        projectId,
        projectClassifiers,
        projectClassifiers.map(getMatchQuery),
        Referrer.LIST_MATCHES
      )
    ),
  });

  return (classifier: TelemetryClassifier): ClassifierListStatsResult => {
    const hasMatches = hasMatchFilter(classifier);
    const classifiedResult =
      classifiedResults[
        classifiersByProject.findIndex(
          ([projectId]) => projectId === classifier.projectId
        )
      ];
    const matchesResult = hasMatches
      ? matchesResults[
          filteredClassifiersByProject.findIndex(
            ([projectId]) => projectId === classifier.projectId
          )
        ]
      : classifiedResult;
    if (!matchesResult || !classifiedResult) {
      return {data: undefined, isError: false, isPending: true};
    }

    const isPending = matchesResult.isPending || classifiedResult.isPending;
    const isError = matchesResult.isError || classifiedResult.isError;
    if (isPending || isError) {
      return {data: undefined, isError, isPending};
    }

    const countField = getCountField(classifier);
    const findSeries = (response: EventsTimeSeriesResponse | undefined) =>
      response?.timeSeries.find(timeSeries => timeSeries.yAxis === countField)?.values ??
      [];
    const series = findSeries(matchesResult.data);

    return {
      data: {
        classified: sumValues(findSeries(classifiedResult.data)),
        hasMatches,
        matches: sumValues(series),
        series,
      },
      isError: false,
      isPending: false,
    };
  };
}
