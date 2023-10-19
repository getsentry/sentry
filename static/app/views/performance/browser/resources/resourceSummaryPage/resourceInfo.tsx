import FileSize from 'sentry/components/fileSize';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils';
import {RateUnits} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {DurationCell} from 'sentry/views/starfish/components/tableCells/durationCell';
import {ThroughputCell} from 'sentry/views/starfish/components/tableCells/throughputCell';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

type Props = {
  avgContentLength: number;
  avgDecodedContentLength: number;
  avgDuration: number;
  avgTransferSize: number;
  throughput: number;
};

function ResourceInfo(props: Props) {
  const {
    avgContentLength,
    avgDecodedContentLength,
    avgDuration,
    avgTransferSize,
    throughput,
  } = props;

  const tooltips = {
    avgContentLength: tct(
      'On average, this resource is [bytes] when encoded (for example when gzipped).',
      {
        bytes: getDynamicText({
          value: formatBytesBase2(avgContentLength),
          fixed: 'xx KB',
        }),
      }
    ),
    avgDecodedContentLength: tct('On average, this resource is [bytes] when decoded.', {
      bytes: getDynamicText({
        value: formatBytesBase2(avgDecodedContentLength),
        fixed: 'xx KB',
      }),
    }),
    avgTransferSize: tct(
      'On average, the total bytes transferred over the network (body + headers) for this resource is [bytes].',
      {
        bytes: getDynamicText({
          value: formatBytesBase2(avgTransferSize),
          fixed: 'xx KB',
        }),
      }
    ),
  };

  return (
    <BlockContainer>
      <Block title={t('Avg encoded size')}>
        <Tooltip isHoverable title={tooltips.avgContentLength} showUnderline>
          <FileSize bytes={avgContentLength} />
        </Tooltip>
      </Block>
      <Block title={t('Avg decoded size')}>
        <Tooltip isHoverable title={tooltips.avgDecodedContentLength} showUnderline>
          <FileSize bytes={avgDecodedContentLength} />
        </Tooltip>
      </Block>
      <Block title={t('Avg transfer size')}>
        <Tooltip isHoverable title={tooltips.avgTransferSize} showUnderline>
          <FileSize bytes={avgTransferSize} />
        </Tooltip>
      </Block>
      <Block title={DataTitles.avg}>
        <DurationCell milliseconds={avgDuration} />
      </Block>
      <Block title={getThroughputTitle('http')}>
        <ThroughputCell rate={throughput * 60} unit={RateUnits.PER_SECOND} />
      </Block>
    </BlockContainer>
  );
}

export default ResourceInfo;
