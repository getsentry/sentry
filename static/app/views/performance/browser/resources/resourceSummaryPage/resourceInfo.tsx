import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import ResourceSize from 'sentry/views/performance/browser/resources/shared/resourceSize';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

type Props = {
  avgContentLength: number;
  avgDecodedContentLength: number;
  avgDuration: number;
  avgTransferSize: number;
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
        <Block title={getThroughputTitle('http')}>
          <ThroughputCell rate={throughput} unit={RESOURCE_THROUGHPUT_UNIT} />
        </Block>
        <Block title={DataTitles['avg(http.response_content_length)']}>
          <Tooltip
            isHoverable
            title={tooltips.avgContentLength}
            showUnderline
            disabled={!avgContentLength}
          >
            <ResourceSize bytes={avgContentLength} />
          </Tooltip>
        </Block>
        <Block title={DataTitles['avg(http.decoded_response_content_length)']}>
          <Tooltip
            isHoverable
            title={tooltips.avgDecodedContentLength}
            showUnderline
            disabled={!avgDecodedContentLength}
          >
            <ResourceSize bytes={avgDecodedContentLength} />
          </Tooltip>
        </Block>
        <Block title={DataTitles['avg(http.response_transfer_size)']}>
          <Tooltip
            isHoverable
            title={tooltips.avgTransferSize}
            showUnderline
            disabled={!avgTransferSize}
          >
            <ResourceSize bytes={avgTransferSize} />
          </Tooltip>
        </Block>
        <Block title={DataTitles.avg}>
          <DurationCell milliseconds={avgDuration} />
        </Block>
        <Block title={DataTitles.timeSpent}>
          <TimeSpentCell percentage={timeSpentPercentage} total={timeSpentTotal} />
        </Block>
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
