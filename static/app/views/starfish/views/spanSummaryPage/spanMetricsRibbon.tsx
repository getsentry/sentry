import {t} from 'sentry/locale';
import {RateUnits} from 'sentry/utils/discover/fields';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

interface Props {
  spanMetrics: {
    [SpanMetricsField.SPAN_OP]?: string;
    [SpanMetricsField.SPAN_DESCRIPTION]?: string;
    [SpanMetricsField.SPAN_ACTION]?: string;
    [SpanMetricsField.SPAN_DOMAIN]?: string[];
    [SpanMetricsField.SPAN_GROUP]?: string;
  };
}

export function SpanMetricsRibbon({spanMetrics}: Props) {
  const op = spanMetrics?.[SpanMetricsField.SPAN_OP] ?? '';

  return (
    <BlockContainer>
      <Block title={getThroughputTitle(op)}>
        <ThroughputCell
          rate={spanMetrics?.[`${SpanFunction.SPM}()`]}
          unit={RateUnits.PER_MINUTE}
        />
      </Block>

      <Block title={DataTitles.avg}>
        <DurationCell
          milliseconds={spanMetrics?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]}
        />
      </Block>

      {op.startsWith('http') && (
        <Block title={t('5XX Responses')} description={t('5XX responses in this span')}>
          <CountCell count={spanMetrics?.[`${SpanFunction.HTTP_ERROR_COUNT}()`]} />
        </Block>
      )}

      <Block title={t('Time Spent')}>
        <TimeSpentCell
          percentage={spanMetrics?.[`${SpanFunction.TIME_SPENT_PERCENTAGE}()`]}
          total={spanMetrics?.[`sum(${SpanMetricsField.SPAN_SELF_TIME})`]}
          op={op}
        />
      </Block>
    </BlockContainer>
  );
}
