import {Fragment, useMemo} from 'react';

import {
  rawSpanKeys,
  type RawSpanType,
} from 'sentry/components/events/interfaces/spans/types';
import {
  getSpanSubTimings,
  isHiddenDataKey,
  type SubTimingInfo,
} from 'sentry/components/events/interfaces/spans/utils';
import {OpsDot} from 'sentry/components/events/opsBreakdown';
import FileSize from 'sentry/components/fileSize';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {KeyValueListDataItem} from 'sentry/types';
import {defined} from 'sentry/utils';
import {isSpanNode} from 'sentry/views/performance/newTraceDetails/guards';
import {
  type TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

const SIZE_DATA_KEYS = [
  'Encoded Body Size',
  'Decoded Body Size',
  'Transfer Size',
  'http.request_content_length',
  'http.response_content_length',
  'http.decoded_response_content_length',
  'http.response_transfer_size',
];

function partitionSizes(data: RawSpanType['data']): {
  nonSizeKeys: {[key: string]: unknown};
  sizeKeys: {[key: string]: number};
} {
  const sizeKeys = SIZE_DATA_KEYS.reduce((keys, key) => {
    if (data.hasOwnProperty(key) && defined(data[key])) {
      try {
        keys[key] = parseFloat(data[key]);
      } catch (e) {
        keys[key] = data[key];
      }
    }
    return keys;
  }, {});

  const nonSizeKeys = {...data};
  SIZE_DATA_KEYS.forEach(key => delete nonSizeKeys[key]);

  return {
    sizeKeys,
    nonSizeKeys,
  };
}

export function SpanKeys({node}: {node: TraceTreeNode<TraceTree.Span>}) {
  const span = node.value;
  const {sizeKeys, nonSizeKeys} = partitionSizes(span?.data ?? {});
  const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
    value => value === 0
  );
  const unknownKeys = Object.keys(span).filter(key => {
    return !isHiddenDataKey(key) && !rawSpanKeys.has(key as any);
  });

  const timingKeys = getSpanSubTimings(span) ?? [];
  const items: SectionCardKeyValueList = [];

  const aggregateMeasurements: SectionCardKeyValueList = useMemo(() => {
    if (!/^ai\.pipeline($|\.)/.test(node.value.op ?? '')) {
      return [];
    }

    let sum = 0;
    TraceTreeNode.ForEachChild(node, n => {
      if (
        isSpanNode(n) &&
        typeof n?.value?.measurements?.ai_total_tokens_used?.value === 'number'
      ) {
        sum += n.value.measurements.ai_total_tokens_used.value;
      }
    });
    return [
      {
        key: 'ai.pipeline',
        subject: 'sum(ai_total_tokens_used)',
        value: sum,
      },
    ];
  }, [node]);

  if (allZeroSizes) {
    items.push({
      key: 'all_zeros_text',
      subject: null,
      value: tct(
        ' The following sizes were not collected for security reasons. Check if the host serves the appropriate [link] header. You may have to enable this collection manually.',
        {
          link: (
            <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin">
              <span className="val-string">Timing-Allow-Origin</span>
            </ExternalLink>
          ),
        }
      ),
    });
  }
  Object.entries(sizeKeys).forEach(([key, value]) => {
    items.push({
      key: key,
      subject: key,
      value: (
        <Fragment>
          <FileSize bytes={value} />
          {value >= 1024 && <span>{` (${value} B)`}</span>}
        </Fragment>
      ),
    });
  });
  Object.entries(nonSizeKeys).forEach(([key, value]) => {
    if (!isHiddenDataKey(key)) {
      items.push({
        key: key,
        subject: key,
        value: value as KeyValueListDataItem['value'],
      });
    }
  });
  unknownKeys.forEach(key => {
    if (key !== 'event' && key !== 'childTransactions') {
      items.push({
        key: key,
        subject: key,
        value: span[key],
      });
    }
  });
  timingKeys.forEach(timing => {
    items.push({
      key: timing.name,
      subject: (
        <TraceDrawerComponents.FlexBox style={{gap: space(0.5)}}>
          <RowTimingPrefix timing={timing} />
          {timing.name}
        </TraceDrawerComponents.FlexBox>
      ),
      value: getPerformanceDuration(Number(timing.duration) * 1000),
    });
  });

  return (
    <TraceDrawerComponents.SectionCard
      items={[...items, ...aggregateMeasurements]}
      title={t('Additional Data')}
    />
  );
}

function RowTimingPrefix({timing}: {timing: SubTimingInfo}) {
  return <OpsDot style={{backgroundColor: timing.color}} />;
}
