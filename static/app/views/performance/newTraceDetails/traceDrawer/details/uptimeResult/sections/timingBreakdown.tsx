import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatDuration} from 'sentry/utils/duration/formatDuration';
import {
  FoldSection,
  SECTION_NEVER_FOLDS,
} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

const TimingBar = styled('div')<{color: string; width: number}>`
  height: 8px;
  background-color: ${p => p.color};
  width: ${p => p.width}%;
  margin-right: ${space(0.5)};
  border-radius: 2px;
`;

const TimingRow = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(1)};

  .timing-label {
    min-width: 140px;
    font-size: ${p => p.theme.fontSizeSmall};
    color: ${p => p.theme.subText};
  }

  .timing-bar-container {
    flex: 1;
    display: flex;
    align-items: center;
    margin: 0 ${space(1)};
  }

  .timing-value {
    min-width: 60px;
    text-align: right;
    font-size: ${p => p.theme.fontSizeSmall};
    font-weight: 600;
  }
`;

export function TimingBreakdown({
  node,
}: {
  node: TraceTreeNode<TraceTree.EAPUptimeResult>;
}) {
  const uptimeResult = node.value;

  const timings = [
    {
      key: 'dns_lookup',
      label: t('DNS Lookup'),
      duration: uptimeResult.dns_lookup_duration_us,
      color: 'var(--purple300)',
    },
    {
      key: 'tcp_connection',
      label: t('TCP Connect'),
      duration: uptimeResult.tcp_connection_duration_us,
      color: 'var(--blue300)',
    },
    {
      key: 'tls_handshake',
      label: t('TLS Handshake'),
      duration: uptimeResult.tls_handshake_duration_us,
      color: 'var(--green300)',
    },
    {
      key: 'time_to_first_byte',
      label: t('Time to First Byte'),
      duration: uptimeResult.time_to_first_byte_duration_us,
      color: 'var(--yellow300)',
    },
  ].filter(timing => timing.duration !== undefined && timing.duration > 0);

  if (timings.length === 0) {
    return null;
  }

  // Calculate the maximum duration for relative bar sizing
  const maxDuration = Math.max(...timings.map(timing => timing.duration!));

  return (
    <FoldSection sectionKey="timing-breakdown" foldThreshold={SECTION_NEVER_FOLDS}>
      <TraceDrawerComponents.SectionCard>
        <TraceDrawerComponents.SectionCardHeader>
          <TraceDrawerComponents.Title>
            {t('Request Timing Breakdown')}
          </TraceDrawerComponents.Title>
        </TraceDrawerComponents.SectionCardHeader>
        <div style={{padding: space(2)}}>
          {timings.map(timing => (
            <TimingRow key={timing.key}>
              <span className="timing-label">{timing.label}</span>
              <div className="timing-bar-container">
                <TimingBar
                  width={(timing.duration! / maxDuration) * 100}
                  color={timing.color}
                />
              </div>
              <span className="timing-value">
                {formatDuration(timing.duration! / 1000)}{' '}
                {/* Convert microseconds to milliseconds */}
              </span>
            </TimingRow>
          ))}

          {uptimeResult.request_duration_us && (
            <Fragment>
              <hr
                style={{
                  margin: `${space(2)} 0`,
                  border: 'none',
                  borderTop: '1px solid var(--border)',
                }}
              />
              <TimingRow>
                <span className="timing-label" style={{fontWeight: 600}}>
                  {t('Total Request Time')}
                </span>
                <div className="timing-bar-container" />
                <span className="timing-value" style={{fontWeight: 600}}>
                  {formatDuration(uptimeResult.request_duration_us / 1000)}
                </span>
              </TimingRow>
            </Fragment>
          )}
        </div>
      </TraceDrawerComponents.SectionCard>
    </FoldSection>
  );
}
