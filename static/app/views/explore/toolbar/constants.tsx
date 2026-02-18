import type {SelectSection} from '@sentry/scraps/compactSelect';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {AggregationKey} from 'sentry/utils/fields';

const toOption = (aggregate: AggregationKey, showDefault = false) => {
  return {
    label: aggregate,
    value: aggregate,
    textValue: aggregate,
    trailingItems: showDefault ? <Text size="xs">{t('Default')}</Text> : undefined,
  };
};

export const SPAN_AGGREGATE_OPTIONS: Array<SelectSection<string>> = [
  {
    key: 'count',
    label: t('Count'),
    options: [
      toOption(AggregationKey.COUNT, true),
      toOption(AggregationKey.COUNT_UNIQUE),
      toOption(AggregationKey.SUM),
    ],
  },
  {
    key: 'percentiles',
    label: t('Percentiles'),
    options: [
      AggregationKey.AVG,
      AggregationKey.P50,
      AggregationKey.P75,
      AggregationKey.P90,
      AggregationKey.P95,
      AggregationKey.P99,
      AggregationKey.P100,
      AggregationKey.MIN,
      AggregationKey.MAX,
    ].map(aggregate => toOption(aggregate)),
  },
  {
    key: 'rate',
    label: t('Rate'),
    options: [AggregationKey.EPM, AggregationKey.EPS].map(aggregate =>
      toOption(aggregate)
    ),
  },
  {
    key: 'error',
    label: t('Error'),
    options: [AggregationKey.FAILURE_RATE, AggregationKey.FAILURE_COUNT].map(aggregate =>
      toOption(aggregate)
    ),
  },
];
