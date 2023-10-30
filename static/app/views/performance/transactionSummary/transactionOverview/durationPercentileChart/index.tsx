import {Fragment} from 'react';
import {Location} from 'history';

import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {Organization, OrganizationSummary} from 'sentry/types';
import {getPercentiles} from 'sentry/views/performance/transactionSummary/transactionOverview/durationPercentileChart/utils';

import {ViewProps} from '../../../types';
import {filterToField, SpanOperationBreakdownFilter} from '../../filter';

import Content from './content';

type Props = ViewProps & {
  currentFilter: SpanOperationBreakdownFilter;
  location: Location;
  organization: OrganizationSummary;
  queryExtras?: Record<string, string>;
};

function DurationPercentileChart({currentFilter, ...props}: Props) {
  const percentiles = getPercentiles(props.organization as Organization);
  const header = (
    <HeaderTitleLegend>
      {currentFilter === SpanOperationBreakdownFilter.NONE
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
    let field: string | undefined;
    if (currentFilter === SpanOperationBreakdownFilter.NONE) {
      field = 'transaction.duration';
    } else {
      field = filterToField(currentFilter);
    }

    return percentiles.map(percentile =>
      percentile === '1' ? `p100(${field})` : `percentile(${field}, ${percentile})`
    );
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
