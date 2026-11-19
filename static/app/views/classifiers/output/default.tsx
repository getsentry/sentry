import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {ALL_RESULTS} from 'sentry/views/classifiers/constants';
import {getHasResultQuery} from 'sentry/views/classifiers/utils';

import {
  BaseClassifierVisualization,
  toPlottable,
  useClassifierTimeSeries,
} from './baseVisualization';
import type {ClassifierOutput, ClassifierVisualizationProps} from './types';

function DefaultResultCell({value}: {value: number}) {
  return (
    <Text tabular align="right">
      {value}
    </Text>
  );
}

function DefaultClassifierVisualization({
  chartType,
  classifier,
  interval,
  pageFilters,
}: ClassifierVisualizationProps) {
  const {data, error, isPending} = useClassifierTimeSeries(classifier, {
    interval,
    pageFilters,
    query: getHasResultQuery(classifier.resultAttribute),
  });
  return (
    <BaseClassifierVisualization
      error={error}
      isPending={isPending}
      pageFilters={pageFilters}
      plottables={[toPlottable(chartType, data?.timeSeries[0], {alias: t('Instances')})]}
      showLegend={false}
    />
  );
}

export const defaultOutput: ClassifierOutput = {
  defaultFilter: ALL_RESULTS,
  filterOptions: [],
  getResultQuery: classifier => getHasResultQuery(classifier.resultAttribute),
  ResultCell: DefaultResultCell,
  Visualization: DefaultClassifierVisualization,
};
