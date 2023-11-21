import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {LinkButton} from 'sentry/components/button';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {Flex} from 'sentry/components/profiling/flex';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toPercent from 'sentry/utils/number/toPercent';
import type {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import type {FlattenedTrace} from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

interface Props {
  flattenedTrace: FlattenedTrace;
  onDimensionChange: () => void;
}

export default function TraceGrid({flattenedTrace, onDimensionChange}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: measureRef});

  const hasSize = width > 0;
  useEffect(() => {
    if (hasSize) {
      onDimensionChange();
    }
  }, [hasSize, onDimensionChange]);

  const trace = flattenedTrace[0].trace;
  const project = projects.find(p => p.id === String(trace.project_id));

  return (
    <Flex column gap={space(1)}>
      <Relative ref={measureRef}>
        {hasSize ? (
          <OverflowHidden>
            <TxnList>
              <SpanDurations flattenedTrace={flattenedTrace} />
            </TxnList>
          </OverflowHidden>
        ) : null}
      </Relative>
      <Flex>
        <LinkButton
          size="xs"
          to={normalizeUrl(
            `/organizations/${organization.slug}/performance/${project?.platform}:${trace.event_id}/`
          )}
        >
          {t('Show full trace')}
        </LinkButton>
      </Flex>
    </Flex>
  );
}

function SpanDurations({flattenedTrace}: {flattenedTrace: FlattenedTrace}) {
  const {projects} = useProjects();

  const traces = flattenedTrace.map(flattened => flattened.trace);
  const startTimestampMs = Math.min(...traces.map(trace => trace.start_timestamp)) * 1000;
  const endTimestampMs = Math.max(
    ...traces.map(trace => trace.start_timestamp * 1000 + trace['transaction.duration'])
  );

  return (
    <Fragment>
      {flattenedTrace.map(flattened => {
        const project = projects.find(p => p.id === String(flattened.trace.project_id));

        return (
          <TwoColumns key={flattened.trace.event_id + '_duration'}>
            <TxnCell>
              <TxnDurationBar
                style={{
                  ...barCSSPosition(startTimestampMs, endTimestampMs, flattened.trace),
                  background: pickBarColor(flattened.trace.transaction['transaction.op']),
                }}
              >
                {project?.platform ? (
                  <Tooltip title={project.platform} containerDisplayMode="inline-flex">
                    <PlatformIcon platform={project.platform} size={12} />
                  </Tooltip>
                ) : null}
              </TxnDurationBar>
            </TxnCell>
            <TxnCell>
              <TxnDuration>{flattened.trace['transaction.duration']}ms</TxnDuration>
            </TxnCell>
          </TwoColumns>
        );
      })}
    </Fragment>
  );
}

function barCSSPosition(
  startTimestampMs: number,
  endTimestampMs: number,
  trace: TraceFullDetailed
) {
  const fullDuration = Math.abs(endTimestampMs - startTimestampMs) || 1;
  const sinceStart = trace.start_timestamp * 1000 - startTimestampMs;
  const duration = trace['transaction.duration'];
  return {
    left: toPercent(sinceStart / fullDuration),
    width: toPercent(duration / fullDuration),
  };
}

const TwoColumns = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
`;
const Relative = styled('div')`
  position: relative;
`;
const OverflowHidden = styled('div')`
  overflow: hidden;
`;

const TxnList = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};

  & > :nth-child(2n + 1) {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const TxnCell = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-self: auto;

  padding: ${space(0.25)} ${space(0.5)};
  overflow: hidden;
`;

const TxnDuration = styled('div')`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: flex-end;
`;

const TxnDurationBar = styled('div')`
  position: absolute;
  display: flex;
  content: '';
  top: 50%;
  transform: translate(0, -50%);
  padding: ${space(0.25)};
  user-select: none;
  min-width: 1px;
`;
