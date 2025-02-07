import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {CheckIndicator} from 'sentry/views/alerts/rules/uptime/checkIndicator';
import {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function IssueUptimeCheckTimeline() {
  const {detectorDetails} = useIssueDetails();
  const {detectorId, detectorType} = detectorDetails;
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    ruleIds: detectorType === 'uptime_monitor' && detectorId ? [detectorId] : [],
    timeWindowConfig,
  });

  const legendStatuses = useMemo(() => {
    const hasUnknownStatus =
      detectorId &&
      uptimeStats?.[detectorId]?.some(
        ([_, stats]) => stats[CheckStatus.MISSED_WINDOW] > 0
      );
    return [CheckStatus.SUCCESS, CheckStatus.MISSED_WINDOW, CheckStatus.FAILURE].filter(
      status => (hasUnknownStatus ? true : status !== CheckStatus.MISSED_WINDOW)
    );
  }, [detectorId, uptimeStats]);

  return (
    <ChartContainer>
      <TimelineLegend ref={elementRef}>
        {legendStatuses.map(status => (
          <Flex align="center" gap={space(0.5)} key={status}>
            <CheckIndicator status={status} width={8} />
            <TimelineLegendText>{statusToText[status]}</TimelineLegendText>
          </Flex>
        ))}
      </TimelineLegend>
      <GridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        timeWindowConfig={timeWindowConfig}
        labelPosition="center-bottom"
      />
      <GridLineLabels timeWindowConfig={timeWindowConfig} labelPosition="center-bottom" />
      <TimelineContainer>
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <CheckInTimeline
            bucketedData={detectorId ? uptimeStats?.[detectorId] ?? [] : []}
            statusLabel={statusToText}
            statusStyle={tickStyle}
            statusPrecedent={checkStatusPrecedent}
            timeWindowConfig={timeWindowConfig}
          />
        )}
      </TimelineContainer>
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  position: relative;
  min-height: 104px;
  width: 100%;
`;

const TimelineLegend = styled('div')`
  position: absolute;
  width: 100%;
  user-select: none;
  display: flex;
  gap: ${space(1)};
  margin-top: ${space(1.5)};
`;

const TimelineLegendText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TimelineContainer = styled('div')`
  position: absolute;
  top: 36px;
`;
