import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import {t, tct} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {DurationUnit, SizeUnit} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/insights/browser/resources/settings';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {getTimeSpentExplanation} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import {
  DataTitles,
  getThroughputTitle,
} from 'sentry/views/insights/common/views/spans/types';

type Props = {
  avgContentLength: number;
  avgDecodedContentLength: number;
  avgDuration: number;
  avgTransferSize: number;
  isLoading: boolean;
  throughput: number;
  timeSpentPercentage: number;
  timeSpentTotal: number;
};

function ResourceInfo(props: Props) {
  const {
    isLoading,
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
      <ReadoutRibbon>
        <MetricReadout
          title={getThroughputTitle('resource')}
          value={throughput}
          unit={RESOURCE_THROUGHPUT_UNIT}
          isLoading={isLoading}
        />

        <MetricReadout
          title={DataTitles['avg(http.response_content_length)']}
          tooltip={tooltips.avgContentLength}
          value={avgContentLength}
          unit={SizeUnit.BYTE}
          isLoading={isLoading}
        />

        <MetricReadout
          title={DataTitles['avg(http.decoded_response_content_length)']}
          value={avgDecodedContentLength}
          tooltip={tooltips.avgDecodedContentLength}
          unit={SizeUnit.BYTE}
          isLoading={isLoading}
        />

        <MetricReadout
          title={DataTitles['avg(http.response_transfer_size)']}
          value={avgTransferSize}
          tooltip={tooltips.avgTransferSize}
          unit={SizeUnit.BYTE}
          isLoading={isLoading}
        />

        <MetricReadout
          title={DataTitles.avg}
          value={avgDuration}
          unit={DurationUnit.MILLISECOND}
          isLoading={isLoading}
        />

        <MetricReadout
          title={DataTitles.timeSpent}
          value={timeSpentTotal}
          unit={DurationUnit.MILLISECOND}
          tooltip={getTimeSpentExplanation(timeSpentPercentage, 'resource')}
          isLoading={isLoading}
        />
      </ReadoutRibbon>

      {hasNoData && (
        <Alert.Container>
          <Alert style={{width: '100%'}} type="warning" showIcon>
            {t(
              "We couldn't find any size information for this resource, this is likely because the `timing-allow-origin` header is not set."
            )}
          </Alert>
        </Alert.Container>
      )}
    </Fragment>
  );
}

export default ResourceInfo;
