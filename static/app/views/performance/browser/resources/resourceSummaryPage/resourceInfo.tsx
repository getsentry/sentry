import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
import {t, tct} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

type Props = {
  avgContentLength: number;
  avgDecodedContentLength: number;
  avgDuration: number;
  avgTransferSize: number;
  spanOp: string;
  throughput: number;
  timeSpentPercentage: number;
  timeSpentTotal: number;
};

function ResourceInfo(props: Props) {
  const {
    avgContentLength,
    avgDecodedContentLength,
    avgDuration,
    avgTransferSize,
    throughput,
    timeSpentPercentage,
    timeSpentTotal,
    spanOp,
  } = props;

  const tooltips = {
    avgContentLength: tct(
      'On average, this resource is [bytes] when encoded (for example when gzipped).',
      {
        bytes: getDynamicText({
          value: formatBytesBase2(avgContentLength),
          fixed: 'xx KiB',
        }),
      }
    ),
    avgDecodedContentLength: tct('On average, this resource is [bytes] when decoded.', {
      bytes: getDynamicText({
        value: formatBytesBase2(avgDecodedContentLength),
        fixed: 'xx KiB',
      }),
    }),
    avgTransferSize: tct(
      'On average, the total bytes transferred over the network (body + headers) for this resource is [bytes].',
      {
        bytes: getDynamicText({
          value: formatBytesBase2(avgTransferSize),
          fixed: 'xx KiB',
        }),
      }
    ),
  };

  const hasNoData =
    avgContentLength === 0 && avgDecodedContentLength === 0 && avgTransferSize === 0;

  return (
    <Fragment>
      <BlockContainer>
        <MetricReadout
          title={getThroughputTitle('http')}
          unit={RateUnit.PER_MINUTE}
          value={throughput}
        />

        <MetricReadout
          title={DataTitles['avg(http.response_content_length)']}
          unit={SizeUnit.BYTE}
          value={avgContentLength}
          tooltip={tooltips.avgContentLength}
        />

        <MetricReadout
          title={DataTitles['avg(http.decoded_response_content_length)']}
          unit={SizeUnit.BYTE}
          value={avgDecodedContentLength}
          tooltip={tooltips.avgDecodedContentLength}
        />

        <MetricReadout
          title={DataTitles['avg(http.response_transfer_size)']}
          unit={SizeUnit.BYTE}
          value={avgTransferSize}
          tooltip={tooltips.avgTransferSize}
        />

        <MetricReadout
          title={DataTitles.avg}
          unit={DurationUnit.MILLISECOND}
          value={avgDuration}
        />

        <MetricReadout
          title={DataTitles.timeSpent}
          value={timeSpentTotal}
          unit={DurationUnit.MILLISECOND}
          tooltip={getTimeSpentExplanation(timeSpentPercentage, spanOp)}
        />
      </BlockContainer>

      {hasNoData && (
        <Alert style={{width: '100%'}} type="warning" showIcon>
          {t(
            "We couldn't find any size information for this resource, this is likely because the `timing-allow-origin` header is not set."
          )}
        </Alert>
      )}
    </Fragment>
  );
}

export default ResourceInfo;
