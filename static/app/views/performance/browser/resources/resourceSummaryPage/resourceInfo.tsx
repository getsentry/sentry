import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

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
      <MetricsRibbon>
        <MetricReadout
          align="left"
          title={getThroughputTitle('resource')}
          value={throughput}
          unit={RESOURCE_THROUGHPUT_UNIT}
        />

        <MetricReadout
          align="left"
          title={DataTitles['avg(http.response_content_length)']}
          tooltip={tooltips.avgContentLength}
          value={avgContentLength}
          unit={SizeUnit.BYTE}
        />

        <MetricReadout
          align="left"
          title={DataTitles['avg(http.decoded_response_content_length)']}
          value={avgDecodedContentLength}
          tooltip={tooltips.avgDecodedContentLength}
          unit={SizeUnit.BYTE}
        />

        <MetricReadout
          align="left"
          title={DataTitles['avg(http.response_transfer_size)']}
          value={avgTransferSize}
          tooltip={tooltips.avgTransferSize}
          unit={SizeUnit.BYTE}
        />

        <MetricReadout
          align="left"
          title={DataTitles.avg}
          value={avgDuration}
          unit={DurationUnit.MILLISECOND}
        />

        <MetricReadout
          align="left"
          title={DataTitles.timeSpent}
          value={timeSpentTotal}
          unit={DurationUnit.MILLISECOND}
          tooltip={getTimeSpentExplanation(timeSpentPercentage, 'resource')}
        />
      </MetricsRibbon>

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

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

export default ResourceInfo;
