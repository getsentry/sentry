import {t, tct} from 'sentry/locale';
import {RateUnits} from 'sentry/utils/discover/fields';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {SpanMetricsFields, StarfishFunctions} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';
import {getSpanOperationDescription} from 'sentry/views/starfish/views/spanSummaryPage/getSpanOperationDescription';

interface Props {
  spanMetrics: {
    [SpanMetricsFields.SPAN_OP]?: string;
    [SpanMetricsFields.SPAN_DESCRIPTION]?: string;
    [SpanMetricsFields.SPAN_ACTION]?: string;
    [SpanMetricsFields.SPAN_DOMAIN]?: string;
    [SpanMetricsFields.SPAN_GROUP]?: string;
  };
}

export function SpanMetricsRibbon({spanMetrics}: Props) {
  const op = spanMetrics?.[SpanMetricsFields.SPAN_OP] ?? '';
  const opDescription = getSpanOperationDescription(op);

  return (
    <BlockContainer>
      {op.startsWith('db') && op !== 'db.redis' && (
        <Block title={t('Table')}>{spanMetrics?.[SpanMetricsFields.SPAN_DOMAIN]}</Block>
      )}

      <Block
        title={getThroughputTitle(op)}
        description={tct('Throughput of this [opDescription] span per minute', {
          opDescription,
        })}
      >
        <ThroughputCell
          rate={spanMetrics?.[`${StarfishFunctions.SPM}()`]}
          unit={RateUnits.PER_MINUTE}
        />
      </Block>

      <Block
        title={DataTitles.avg}
        description={tct(
          'The average duration of [opDescription] spans in the selected period',
          {
            opDescription,
          }
        )}
      >
        <DurationCell
          milliseconds={spanMetrics?.[`avg(${SpanMetricsFields.SPAN_SELF_TIME})`]}
        />
      </Block>

      {op.startsWith('http') && (
        <Block title={t('5XX Responses')} description={t('5XX responses in this span')}>
          <CountCell count={spanMetrics?.[`${StarfishFunctions.HTTP_ERROR_COUNT}()`]} />
        </Block>
      )}

      <Block
        title={t('Time Spent')}
        description={t(
          'Time spent in this span as a proportion of total application time'
        )}
      >
        <TimeSpentCell
          percentage={spanMetrics?.[`${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`]}
          total={spanMetrics?.[`sum(${SpanMetricsFields.SPAN_SELF_TIME})`]}
        />
      </Block>
    </BlockContainer>
  );
}
