import {Fragment} from 'react';
import {Location} from 'history';

import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';

import {ViewProps} from '../../../types';
import {filterToField, SpanOperationBreakdownFilter} from '../../filter';

import Content from './content';

type Props = ViewProps & {
  currentFilter: SpanOperationBreakdownFilter;
  location: Location;
  organization: OrganizationSummary;
};

function DurationPercentileChart({currentFilter, ...props}: Props) {
  const header = (
    <HeaderTitleLegend>
      {currentFilter === SpanOperationBreakdownFilter.None
        ? t('Duration Percentiles')
        : tct('Span Operation Percentiles - [operationName]', {
            operationName: currentFilter,
          })}
      <QuestionTooltip
        position="top"
        size="sm"
        title={t(
          `Compare the duration at each percentile. Compare with Latency Histogram to see transaction volume at duration intervals.`
        )}
      />
    </HeaderTitleLegend>
  );

  function generateFields() {
    if (currentFilter === SpanOperationBreakdownFilter.None) {
      return [
        'percentile(transaction.duration, 0.10)',
        'percentile(transaction.duration, 0.25)',
        'percentile(transaction.duration, 0.50)',
        'percentile(transaction.duration, 0.75)',
        'percentile(transaction.duration, 0.90)',
        'percentile(transaction.duration, 0.95)',
        'percentile(transaction.duration, 0.99)',
        'percentile(transaction.duration, 0.995)',
        'percentile(transaction.duration, 0.999)',
        'p100()',
      ];
    }

    const field = filterToField(currentFilter);

    return [
      `percentile(${field}, 0.10)`,
      `percentile(${field}, 0.25)`,
      `percentile(${field}, 0.50)`,
      `percentile(${field}, 0.75)`,
      `percentile(${field}, 0.90)`,
      `percentile(${field}, 0.95)`,
      `percentile(${field}, 0.99)`,
      `percentile(${field}, 0.995)`,
      `percentile(${field}, 0.999)`,
      `p100(${field})`,
    ];
  }

  const fields = generateFields();

  return (
    <Fragment>
      {header}
      <Content {...props} currentFilter={currentFilter} fields={fields} />
    </Fragment>
  );
}

export default DurationPercentileChart;
