import {Fragment} from 'react';
import {Location} from 'history';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

import {ViewProps} from '../../../types';
import {SpanOperationBreakdownFilter} from '../../filter';

import Content from './content';

type Props = ViewProps & {
  organization: OrganizationSummary;
  location: Location;
  currentFilter: SpanOperationBreakdownFilter;
};

function LatencyChart({currentFilter, ...props}: Props) {
  const {isMetricsData} = useMetricsSwitch();

  const header = (
    <HeaderTitleLegend>
      {currentFilter === SpanOperationBreakdownFilter.None
        ? t('Duration Distribution')
        : tct('Span Operation Distribution - [operationName]', {
            operationName: currentFilter,
          })}
      <QuestionTooltip
        position="top"
        size="sm"
        title={t(
          `Duration Distribution reflects the volume of transactions per median duration.`
        )}
      />
    </HeaderTitleLegend>
  );

  if (isMetricsData) {
    return (
      <Fragment>
        {header}
        <ErrorPanel>TODO: Distribution</ErrorPanel>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {header}
      <Content {...props} currentFilter={currentFilter} />
    </Fragment>
  );
}

export default LatencyChart;
