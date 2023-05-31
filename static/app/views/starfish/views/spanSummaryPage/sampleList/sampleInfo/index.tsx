import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {formatPercentage} from 'sentry/utils/formatters';
import {useApplicationMetrics} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {useSpanTransactionMetrics} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {DataTitles, getTooltip} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage';

type Props = {
  groupId: string;
  transactionName: string;
};

function SampleInfo(props: Props) {
  const {groupId, transactionName} = props;

  const {data: spanMetrics} = useSpanTransactionMetrics({group_id: groupId}, [
    transactionName,
  ]);
  const {data: applicationMetrics} = useApplicationMetrics();
  const spm = spanMetrics[transactionName]?.spm;
  const p50 = spanMetrics[transactionName]?.p50;
  const span_total_time = spanMetrics[transactionName]?.total_time;
  const application_total_time = applicationMetrics['sum(span.duration)'];

  const tooltip = getTooltip('timeSpent', span_total_time, application_total_time);

  return (
    <BlockContainer>
      <Block title={t('Throughput')}>{spm?.toFixed(2)} / min</Block>
      <Block title={t('Duration (P50)')}>{p50?.toFixed(2)} ms</Block>
      <Block title={DataTitles.timeSpent}>
        <Tooltip title={tooltip}>
          {formatPercentage(span_total_time / application_total_time)}
        </Tooltip>
      </Block>
    </BlockContainer>
  );
}

export default SampleInfo;
