import {useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {getTickStyle} from 'sentry/components/checkInTimeline/utils/getTickStyle';
import {Flex} from 'sentry/components/container/flex';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function IssueUptimeCheckTimeline() {
  const theme = useTheme();
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

  return (
    <ChartContainer>
      <TimelineGridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        timeWindowConfig={timeWindowConfig}
        gridLineStyles={{
          border: 'none',
          height: space(0.5),
          width: 1,
          borderRadius: 1,
          background: theme.translucentBorder,
          top: 68,
        }}
        underscanStyles={{
          margin: 0,
          height: '100%',
        }}
      />
      <TimelineLegend ref={elementRef}>
        {checkStatusPrecedent.map(status => (
          <Flex align="center" gap={space(0.5)} key={status}>
            <Circle css={getTickStyle(tickStyle, status, theme)} />
            <TimelineLegendText>{statusToText[status]}</TimelineLegendText>
          </Flex>
        ))}
      </TimelineLegend>
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
      <TimelineLabels timeWindowConfig={timeWindowConfig} centered />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  min-height: 104px;
  width: 100%;
  position: relative;
`;

const TimelineGridLineOverlay = styled(GridLineOverlay)``;

const TimelineLegend = styled('div')`
  display: flex;
  gap: ${space(1)};
  position: absolute;
  width: 100%;
  margin-top: ${space(1.5)};
  user-select: none;
`;

const TimelineLegendText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TimelineContainer = styled('div')`
  position: absolute;
  top: 36px;
`;

const TimelineLabels = styled(GridLineLabels)`
  border-top: 1px solid ${p => p.theme.translucentBorder};
  height: 24px;
  box-shadow: none;
  top: 68px;
  &:before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    height: ${space(0.5)};
    width: 1px;
    border-radius: 1px;
    background: ${p => p.theme.translucentBorder};
  }
`;

const Circle = styled('div')`
  height: ${space(1)};
  width: ${space(1)};
  border-radius: 50%;
`;
