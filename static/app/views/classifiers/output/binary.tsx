import {useTheme} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {ALL_RESULTS} from 'sentry/views/classifiers/constants';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getHasResultQuery, getResultField} from 'sentry/views/classifiers/utils';

import {
  BaseClassifierVisualization,
  createPlottable,
  useClassifierTimeSeries,
} from './baseVisualization';
import type {ClassifierOutput, ClassifierVisualizationProps} from './types';

const MATCHES = 'matches';
const NON_MATCHES = 'non-matches';

function getThresholdQuery(
  classifier: TelemetryClassifier,
  side: typeof MATCHES | typeof NON_MATCHES
) {
  const operator = side === MATCHES ? '>=' : '<';
  return `${getResultField(classifier.resultAttribute)}:${operator}${classifier.binaryThreshold}`;
}

function BinaryResultCell({
  classifier,
  value,
}: {
  classifier: TelemetryClassifier;
  value: number;
}) {
  const isMatch =
    classifier.binaryThreshold !== null && value >= classifier.binaryThreshold;
  return (
    <Flex justify="end">
      <Tag variant={isMatch ? 'info' : 'muted'}>{isMatch ? t('True') : t('False')}</Tag>
    </Flex>
  );
}

function BinaryClassifierVisualization({
  chartType,
  classifier,
  filter,
  interval,
  pageFilters,
}: ClassifierVisualizationProps) {
  const theme = useTheme();
  const neutral = theme.tokens.dataviz.semantic.neutral;
  const isGrouped = filter === ALL_RESULTS;
  const isNonMatches = filter === NON_MATCHES;

  const primary = useClassifierTimeSeries(classifier, {
    interval,
    pageFilters,
    query: getThresholdQuery(classifier, isNonMatches ? NON_MATCHES : MATCHES),
  });
  const nonMatches = useClassifierTimeSeries(classifier, {
    interval,
    pageFilters,
    query: getThresholdQuery(classifier, NON_MATCHES),
    enabled: isGrouped,
  });

  return (
    <BaseClassifierVisualization
      error={primary.error ?? (isGrouped ? nonMatches.error : null)}
      isPending={primary.isPending || (isGrouped && nonMatches.isPending)}
      pageFilters={pageFilters}
      plottables={
        isGrouped
          ? [
              createPlottable(chartType, primary.data?.timeSeries[0], {
                alias: t('Matches'),
              }),
              createPlottable(chartType, nonMatches.data?.timeSeries[0], {
                alias: t('Non-matches'),
                color: neutral,
              }),
            ]
          : [
              createPlottable(chartType, primary.data?.timeSeries[0], {
                alias: t('Instances'),
                color: isNonMatches ? neutral : undefined,
              }),
            ]
      }
      showLegend={isGrouped}
    />
  );
}

export const binaryOutput: ClassifierOutput = {
  defaultFilter: MATCHES,
  filterOptions: [
    {value: ALL_RESULTS, label: t('Show all')},
    {value: MATCHES, label: t('Show matches')},
    {value: NON_MATCHES, label: t('Show non-matches')},
  ],
  getResultQuery: (classifier, filter) =>
    filter === MATCHES || filter === NON_MATCHES
      ? getThresholdQuery(classifier, filter)
      : getHasResultQuery(classifier.resultAttribute),
  ResultCell: BinaryResultCell,
  Visualization: BinaryClassifierVisualization,
};
