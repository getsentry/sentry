import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {TimeRangeSelectTrigger} from 'sentry/components/timeRangeSelector';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';
import {useDimensions} from 'sentry/utils/useDimensions';

import {useTimeWindowConfig} from './hooks/useTimeWindowConfig';
import {CheckInTimeline} from './checkInTimeline';
import {GridLineLabels, GridLineOverlay} from './gridLines';
import type {CheckInBucket, TickStyle, TimeWindowConfig} from './types';

enum ExampleStatus {
  OK = 'ok',
  ERROR = 'error',
  TIMEOUT = 'timeout',
}

const statusStyle: TickStyle<ExampleStatus> = theme => ({
  [ExampleStatus.ERROR]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
  },
  [ExampleStatus.TIMEOUT]: {
    labelColor: theme.colors.yellow500,
    tickColor: theme.colors.yellow400,
    hatchTick: theme.colors.yellow200,
  },
  [ExampleStatus.OK]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
  },
});

const statusLabel: Record<ExampleStatus, string> = {
  [ExampleStatus.OK]: 'Okay',
  [ExampleStatus.ERROR]: 'Error',
  [ExampleStatus.TIMEOUT]: 'Timeout',
};

const statusPrecedent = [ExampleStatus.OK, ExampleStatus.TIMEOUT, ExampleStatus.ERROR];

function generateMockTickData(
  secondsGap: number,
  timeWindowConfig: TimeWindowConfig
): Array<CheckInBucket<ExampleStatus>> {
  const buckets = timeWindowConfig.timelineWidth;
  const secondsPerBucket = (timeWindowConfig.elapsedMinutes * 60) / buckets;

  return new Array(timeWindowConfig.timelineWidth)
    .fill(null)
    .map<CheckInBucket<ExampleStatus>>((_, bucketIndex) => {
      const second = Math.floor(bucketIndex * secondsPerBucket);
      const ts = timeWindowConfig.start.getTime() / 1000 + second;

      const includesStatus =
        second + secondsPerBucket > Math.ceil(second / secondsGap) * secondsGap;

      // Show miss and errors in the last
      const last20Percent = bucketIndex / timeWindowConfig.timelineWidth > 0.8;
      const last10Percent = bucketIndex / timeWindowConfig.timelineWidth > 0.9;

      return [
        ts,
        {
          [ExampleStatus.OK]: includesStatus && !last20Percent ? 1 : 0,
          [ExampleStatus.TIMEOUT]: includesStatus && last20Percent ? 1 : 0,
          [ExampleStatus.ERROR]: includesStatus && last10Percent ? 1 : 0,
        },
      ];
    })
    .filter(([ts, _]) => ts <= timeWindowConfig.end.getTime() / 1000);
}

export default Storybook.story('CheckInTimeline', story => {
  story('Simple', () => {
    const elementRef = useRef<HTMLDivElement>(null);
    const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});
    const timeWindowConfig = useTimeWindowConfig({timelineWidth});

    const [secondsGap, setSecondsGap] = useState(60);
    const data = useMemo(
      () => generateMockTickData(secondsGap, timeWindowConfig),
      [secondsGap, timeWindowConfig]
    );

    return (
      <PageFiltersContainer>
        <p>
          The <Storybook.JSXNode name="CheckInTimeline" /> component may be used to render
          a timeline of 'check-ins'.
        </p>
        <p>
          The timeline is given a list of "Buckets" where each bucket contains a time
          range of check-ins. Buckets are contiguous, so if there is a 5 second
          resolution, each bucket contains 5 seconds worth of check-in data. Buckets that
          are contiguously the same status will be merged together visually.
        </p>

        <Controls>
          <DatePageFilter
            trigger={triggerProps => (
              <TimeRangeSelectTrigger {...triggerProps} prefix="Time Window" />
            )}
          />
          <CompactSelect
            triggerProps={{prefix: 'Spacing'}}
            options={[
              {value: 60, label: '1 Minute'},
              {value: 60 * 5, label: '5 Minute'},
              {value: 60 * 30, label: '30 Minute'},
              {value: 60 * 60, label: '1 Hour'},
            ]}
            onChange={item => setSecondsGap(item.value)}
            value={secondsGap}
          />
        </Controls>
        <ExampleContainer>
          <Flex align="center" width="100%" height="40px" ref={elementRef}>
            <CheckInTimeline
              bucketedData={data}
              statusStyle={statusStyle}
              statusLabel={statusLabel}
              statusPrecedent={statusPrecedent}
              timeWindowConfig={timeWindowConfig}
            />
          </Flex>
        </ExampleContainer>

        <p>
          You may compose various components exposed in the <code>checkInTimeline</code>{' '}
          module together to create a more visually useful timeline. See:{' '}
          <Storybook.JSXNode name="GridLineOverlay" /> and{' '}
          <Storybook.JSXNode name="GridLineLabels" />
        </p>

        <ExampleContainer>
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <GridLineOverlay timeWindowConfig={timeWindowConfig} />
          <Flex align="center" width="100%" height="40px" ref={elementRef}>
            <CheckInTimeline
              bucketedData={data}
              statusStyle={statusStyle}
              statusLabel={statusLabel}
              statusPrecedent={statusPrecedent}
              timeWindowConfig={timeWindowConfig}
            />
          </Flex>
        </ExampleContainer>

        <p>
          Enabling the <Storybook.JSXProperty name="allowZoom" value /> and{' '}
          <Storybook.JSXProperty name="showCursor" value /> attributes of the{' '}
          <Storybook.JSXNode name="GridLineOverlay" /> will make the timeline more
          interactive.
        </p>

        <ExampleContainer>
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <GridLineOverlay
            showCursor
            allowZoom
            cursorOverlayAnchorOffset={10}
            timeWindowConfig={timeWindowConfig}
          />
          <Flex align="center" width="100%" height="40px" ref={elementRef}>
            <CheckInTimeline
              bucketedData={data}
              statusStyle={statusStyle}
              statusLabel={statusLabel}
              statusPrecedent={statusPrecedent}
              timeWindowConfig={timeWindowConfig}
            />
          </Flex>
        </ExampleContainer>
      </PageFiltersContainer>
    );
  });
});

const Controls = styled(ButtonBar)`
  width: max-content;
  margin-bottom: ${space(1)};
`;

const ExampleContainer = styled(NegativeSpaceContainer)`
  position: relative;
  flex-direction: column;
`;
