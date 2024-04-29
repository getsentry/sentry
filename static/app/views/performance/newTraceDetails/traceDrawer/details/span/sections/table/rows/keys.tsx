import {Fragment} from 'react';
import styled from '@emotion/styled';

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
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {GeneralSpanDetailsValue} from 'sentry/views/performance/traceDetails/newTraceDetailsValueRenderer';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

import {TraceDrawerComponents} from '../../../../styles';

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

  return (
    <Fragment>
      {allZeroSizes && (
        <TextTr>
          The following sizes were not collected for security reasons. Check if the host
          serves the appropriate
          <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin">
            <span className="val-string">Timing-Allow-Origin</span>
          </ExternalLink>
          header. You may have to enable this collection manually.
        </TextTr>
      )}
      {Object.entries(sizeKeys).map(([key, value]) => (
        <TraceDrawerComponents.TableRow title={key} key={key}>
          <Fragment>
            <FileSize bytes={value} />
            {value >= 1024 && <span>{` (${value} B)`}</span>}
          </Fragment>
        </TraceDrawerComponents.TableRow>
      ))}
      {Object.entries(nonSizeKeys).map(([key, value]) =>
        !isHiddenDataKey(key) ? (
          <TraceDrawerComponents.TableRow title={key} key={key}>
            <GeneralSpanDetailsValue value={value} />
          </TraceDrawerComponents.TableRow>
        ) : null
      )}
      {unknownKeys.map(key => {
        if (key === 'event' || key === 'childTransactions') {
          // dont render the entire JSON payload
          return null;
        }

        return (
          <TraceDrawerComponents.TableRow title={key} key={key}>
            <GeneralSpanDetailsValue value={span[key]} />
          </TraceDrawerComponents.TableRow>
        );
      })}
      {timingKeys.map(timing => (
        <TraceDrawerComponents.TableRow
          title={timing.name}
          key={timing.name}
          prefix={<RowTimingPrefix timing={timing} />}
        >
          {getPerformanceDuration(Number(timing.duration) * 1000)}
        </TraceDrawerComponents.TableRow>
      ))}
    </Fragment>
  );
}

function RowTimingPrefix({timing}: {timing: SubTimingInfo}) {
  return <OpsDot style={{backgroundColor: timing.color}} />;
}

const ValueTd = styled('td')`
  position: relative;
`;

function TextTr({children}) {
  return (
    <tr>
      <td className="key" />
      <ValueTd className="value">
        <StyledText>{children}</StyledText>
      </ValueTd>
    </tr>
  );
}

const StyledText = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(2)} ${space(0)};
`;
