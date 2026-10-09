import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {useDebouncedValue} from '@tanstack/react-pacer';

import {Table, type TableColumnConfig} from '@sentry/scraps/table';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tn} from 'sentry/locale';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {useDimensions} from 'sentry/utils/useDimensions';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';

import type {CheckStatusBucket} from './types';

const COLUMNS: TableColumnConfig[] = [{key: 'timeline', width: '1fr'}];

interface Props {
  /**
   * Called when stats have been loaded for this timeline.
   */
  onStatsLoaded: (stats: CheckStatusBucket[]) => void;
  uptimeDetector: UptimeDetector;
}

export function DetailsTimeline({uptimeDetector, onStatsLoaded}: Props) {
  const {id} = uptimeDetector;
  const elementRef = useRef<HTMLTableCellElement>(null);
  const {width: containerWidth} = useDimensions({elementRef});
  const [timelineWidth] = useDebouncedValue(containerWidth, {wait: 500});

  const timeWindowConfig = useTimeWindowConfig({
    timelineWidth,
    recomputeInterval: 60_000,
    recomputeOnWindowFocus: true,
  });

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    detectorIds: [id],
    timeWindowConfig,
  });

  useEffect(
    () => uptimeStats?.[id] && onStatsLoaded?.(uptimeStats[id]),
    [onStatsLoaded, uptimeStats, id]
  );

  return (
    <SimpleTable
      aria-label={t('Uptime check timeline')}
      columns={COLUMNS}
      header={
        <TimelineHeaderRow>
          <TimelineHeaderCell ref={elementRef} scope="col" aria-label={t('Timeline')}>
            <GridLineLabels timeWindowConfig={timeWindowConfig} />
            <TimelineOverlay
              allowZoom
              resetPaginationOnZoom
              showCursor
              timeWindowConfig={timeWindowConfig}
              cursorOverlayAnchor="top"
              cursorOverlayAnchorOffset={10}
            />
          </TimelineHeaderCell>
        </TimelineHeaderRow>
      }
    >
      <SimpleTable.Row>
        <SimpleTable.RowCell padding="lg 0">
          {isPending ? (
            <CheckInPlaceholder />
          ) : (
            <CheckInTimeline
              bucketedData={uptimeStats?.[id] ?? []}
              statusLabel={statusToText}
              statusStyle={tickStyle}
              statusPrecedent={checkStatusPrecedent}
              timeWindowConfig={timeWindowConfig}
              makeUnit={count => tn('check', 'checks', count)}
            />
          )}
        </SimpleTable.RowCell>
      </SimpleTable.Row>
    </SimpleTable>
  );
}

// The overlay spans the header and the row, so it positions against the table
// rather than the header row or cell it is rendered in.
const TimelineHeaderRow = styled(SimpleTable.HeaderRow)`
  position: static;
`;

const TimelineHeaderCell = styled(Table.HeadCell)`
  position: static;
  flex-direction: column;
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;

const TimelineOverlay = styled(GridLineOverlay)`
  inset: 0;
`;
