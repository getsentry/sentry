import {Fragment} from 'react';
import {Location} from 'history';

import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';

import {ViewProps} from '../../../types';
import {SpanOperationBreakdownFilter} from '../../filter';

import Content from './content';

type Props = ViewProps & {
  currentFilter: SpanOperationBreakdownFilter;
  location: Location;
  organization: OrganizationSummary;
  queryExtras?: Record<string, string>;
  totalCount?: number | null;
};

function LatencyChart({currentFilter, ...props}: Props) {
  const header = (
    <HeaderTitleLegend>
      {currentFilter === SpanOperationBreakdownFilter.NONE
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

  return (
    <Fragment>
      {header}
      <Content {...props} currentFilter={currentFilter} />
    </Fragment>
  );
}

export default LatencyChart;
