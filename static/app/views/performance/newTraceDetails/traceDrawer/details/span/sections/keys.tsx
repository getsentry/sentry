import {Fragment, useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';

import {ExternalLink} from 'sentry/components/core/link';
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
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {
  TraceDrawerComponents,
  type SectionCardKeyValueList,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {TraceDrawerActionValueKind} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

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
  nonSizeKeys: Record<string, unknown>;
  sizeKeys: Record<string, number>;
} {
  if (!data) {
    return {
      sizeKeys: {},
      nonSizeKeys: {},
    };
  }
  const sizeKeys = SIZE_DATA_KEYS.reduce(
    (keys, key) => {
      if (data.hasOwnProperty(key) && defined(data[key])) {
        try {
          keys[key] = parseFloat(data[key]);
        } catch (e) {
          keys[key] = data[key];
        }
      }
      return keys;
    },
    {} as Record<string, number>
  );

  const nonSizeKeys = {...data};
  SIZE_DATA_KEYS.forEach(key => delete nonSizeKeys[key]);

  return {
    sizeKeys,
    nonSizeKeys,
  };
}

function getSpanAggregateMeasurements(node: SpanNode) {
  if (!/^ai\.pipeline($|\.)/.test(node.value.op ?? '')) {
    return [];
  }

  let sum = 0;
  node.forEachChild(n => {
    const tokens =
      typeof n.measurements?.ai_total_tokens_used === 'number'
        ? n.measurements?.ai_total_tokens_used
        : (n.measurements?.ai_total_tokens_used?.value ?? 0);
    if (tokens) {
      sum += tokens;
    }
  });
  return [
    {
      key: 'ai.pipeline',
      subject: 'sum(ai_total_tokens_used)',
      value: sum,
    },
  ];
}

export function hasSpanKeys(node: SpanNode, theme: Theme) {
  const {sizeKeys, nonSizeKeys} = partitionSizes(node.value?.data ?? {});
  const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
    value => value === 0
  );
  const unknownKeys = Object.keys(node.value).filter(key => {
    return !isHiddenDataKey(key) && !rawSpanKeys.has(key as any);
  });
  const timingKeys = getSpanSubTimings(node.value, theme) ?? [];
  const aggregateMeasurements: SectionCardKeyValueList =
    getSpanAggregateMeasurements(node);
  return (
    allZeroSizes ||
    unknownKeys.length > 0 ||
    timingKeys.length > 0 ||
    aggregateMeasurements.length > 0 ||
    Object.keys(nonSizeKeys).length > 0 ||
    Object.keys(sizeKeys).length > 0
  );
}

export function SpanKeys({node}: {node: SpanNode}) {
  const theme = useTheme();
  const span = node.value;
  const projectIds = node.event?.projectID;
  const {sizeKeys, nonSizeKeys} = partitionSizes(span?.data ?? {});
  const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
    value => value === 0
  );
  const unknownKeys = Object.keys(span).filter(key => {
    return !isHiddenDataKey(key) && !rawSpanKeys.has(key as any);
  });

  const timingKeys = getSpanSubTimings(span, theme) ?? [];
  const items: SectionCardKeyValueList = [];

  const aggregateMeasurements: SectionCardKeyValueList = useMemo(() => {
    return getSpanAggregateMeasurements(node);
  }, [node]);

  if (allZeroSizes) {
    items.push({
      key: 'all_zeros_text',
      subject: t('Timing-Allow-Origin'),
      subjectNode: null,
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
      key,
      subject: key,
      value: (
        <Fragment>
          <FileSize bytes={value} />
          {value >= 1024 && <span>{` (${value} B)`}</span>}
        </Fragment>
      ),
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={key}
          rowValue={value}
          kind={TraceDrawerActionValueKind.ADDITIONAL_DATA}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    });
  });
  Object.entries(nonSizeKeys).forEach(([key, value]) => {
    if (!isHiddenDataKey(key)) {
      items.push({
        key,
        subject: key,
        value: value as string | number,
        actionButton: (
          <TraceDrawerComponents.KeyValueAction
            rowKey={key}
            rowValue={value as string | number}
            kind={TraceDrawerActionValueKind.ADDITIONAL_DATA}
            projectIds={projectIds}
          />
        ),
        actionButtonAlwaysVisible: true,
      });
    }
  });
  unknownKeys.forEach(key => {
    items.push({
      key,
      subject: key,
      value: (span as any)[key],
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={key}
          rowValue={(span as any)[key]}
          kind={TraceDrawerActionValueKind.ADDITIONAL_DATA}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    });
  });
  timingKeys.forEach(timing => {
    items.push({
      key: timing.name,
      subject: toTitleCase(timing.name),
      subjectNode: (
        <TraceDrawerComponents.FlexBox style={{gap: space(0.5)}}>
          <RowTimingPrefix timing={timing} />
          {timing.name}
        </TraceDrawerComponents.FlexBox>
      ),
      value: getPerformanceDuration(Number(timing.duration) * 1000),
      actionButton: (
        <TraceDrawerComponents.KeyValueAction
          rowKey={timing.name}
          rowValue={getPerformanceDuration(Number(timing.duration) * 1000)}
          kind={TraceDrawerActionValueKind.ADDITIONAL_DATA}
          projectIds={projectIds}
        />
      ),
      actionButtonAlwaysVisible: true,
    });
  });

  return (
    <TraceDrawerComponents.SectionCard
      items={[...items, ...aggregateMeasurements]}
      title={t('Additional Data')}
      sortAlphabetically
    />
  );
}

function RowTimingPrefix({timing}: {timing: SubTimingInfo}) {
  return <OpsDot style={{backgroundColor: timing.color}} />;
}
