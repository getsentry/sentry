import {useRef} from 'react';
import styled from '@emotion/styled';

import {DateNavigator} from 'sentry/components/checkInTimeline/dateNavigator';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useDateNavigation} from 'sentry/components/checkInTimeline/hooks/useDateNavigation';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import Panel from 'sentry/components/panels/panel';
import {Sticky} from 'sentry/components/sticky';
import {space} from 'sentry/styles/space';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {UptimeRule} from 'sentry/views/alerts/rules/uptime/types';

import {OverviewRow} from './overviewRow';

interface Props {
  uptimeRules: UptimeRule[];
}

export function OverviewTimeline({uptimeRules}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);

  const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const dateNavigation = useDateNavigation();

  return (
    <MonitorListPanel role="region">
      <TimelineWidthTracker ref={elementRef} />
      <Header>
        <HeaderControlsLeft>
          <DateNavigator
            dateNavigation={dateNavigation}
            direction="back"
            size="xs"
            borderless
          />
        </HeaderControlsLeft>
        <AlignedGridLineLabels timeWindowConfig={timeWindowConfig} />
        <HeaderControlsRight>
          <DateNavigator
            dateNavigation={dateNavigation}
            direction="forward"
            size="xs"
            borderless
          />
        </HeaderControlsRight>
      </Header>
      <AlignedGridLineOverlay
        stickyCursor
        allowZoom
        showCursor
        cursorOffsets={{right: 40}}
        timeWindowConfig={timeWindowConfig}
      />
      <UptimeAlertRow>
        {uptimeRules.map(uptimeRule => (
          <OverviewRow
            key={uptimeRule.id}
            timeWindowConfig={timeWindowConfig}
            uptimeRule={uptimeRule}
          />
        ))}
      </UptimeAlertRow>
    </MonitorListPanel>
  );
}

const Header = styled(Sticky)`
  display: grid;
  grid-column: 1/-1;
  grid-template-columns: subgrid;

  z-index: 1;
  background: ${p => p.theme.background};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 1px ${p => p.theme.translucentBorder};

  &[data-stuck] {
    border-radius: 0;
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
    margin: 0 -1px;
  }
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 2/-1;
`;
const AlignedGridLineOverlay = styled(GridLineOverlay)`
  grid-row: 1;
  grid-column: 2/-1;
`;

const AlignedGridLineLabels = styled(GridLineLabels)`
  grid-row: 1;
  grid-column: 2/-1;
`;

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 1fr max-content;
`;

const UptimeAlertRow = styled('ul')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const HeaderControlsLeft = styled('div')`
  grid-column: 1;
  display: flex;
  justify-content: flex-end;
  padding: ${space(1.5)} ${space(2)};
`;

const HeaderControlsRight = styled('div')`
  grid-row: 1;
  grid-column: -1;
  padding: ${space(1.5)} ${space(2)};
`;
