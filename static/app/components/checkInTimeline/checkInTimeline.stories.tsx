import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';
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

const statusStyle: Record<ExampleStatus, TickStyle> = {
  [ExampleStatus.ERROR]: {
    labelColor: 'red400',
    tickColor: 'red300',
  },
  [ExampleStatus.TIMEOUT]: {
    labelColor: 'yellow400',
    tickColor: 'yellow300',
    hatchTick: 'yellow200',
  },
  [ExampleStatus.OK]: {
    labelColor: 'green400',
    tickColor: 'green300',
  },
};

const statusLabel: Record<ExampleStatus, string> = {
  [ExampleStatus.OK]: 'Okay',
  [ExampleStatus.ERROR]: 'Error',
  [ExampleStatus.TIMEOUT]: 'Timeout',
};

const statusPrecedent = [ExampleStatus.OK, ExampleStatus.TIMEOUT, ExampleStatus.ERROR];

function generateMockTickData(
  secondsGap: number,
  timeWindowConfig: TimeWindowConfig
): CheckInBucket<ExampleStatus>[] {
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

export default storyBook(CheckInTimeline, story => {
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
          The <JSXNode name="CheckInTimeline" /> component may be used to render a
          timeline of 'check-ins'.
        </p>
        <p>
          The timeline is given a list of "Buckets" where each bucket contains a time
          range of check-ins. Buckets are contiguous, so if there is a 5 second
          resolution, each bucket contains 5 seconds worth of check-in data. Buckets that
          are contiguously the same status will be merged together visually.
        </p>

        <Controls gap={1}>
          <DatePageFilter triggerProps={{prefix: 'Time Window'}} />
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
          <div ref={elementRef} style={{width: '100%', height: 40}}>
            <CheckInTimeline
              bucketedData={data}
              statusStyle={statusStyle}
              statusLabel={statusLabel}
              statusPrecedent={statusPrecedent}
              timeWindowConfig={timeWindowConfig}
            />
          </div>
        </ExampleContainer>

        <p>
          You may compose various components exposed in the <code>checkInTimeline</code>{' '}
          module together to create a more visually useful timeline. See:{' '}
          <JSXNode name="GridLineOverlay" /> and <JSXNode name="GridLineLabels" />
        </p>

        <ExampleContainer>
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <GridLineOverlay timeWindowConfig={timeWindowConfig} />
          <div ref={elementRef} style={{width: '100%', height: 40}}>
            <CheckInTimeline
              bucketedData={data}
              statusStyle={statusStyle}
              statusLabel={statusLabel}
              statusPrecedent={statusPrecedent}
              timeWindowConfig={timeWindowConfig}
            />
          </div>
        </ExampleContainer>

        <p>
          Enabling the <JSXProperty name="allowZoom" value /> and{' '}
          <JSXProperty name="showCursor" value /> attributes of the{' '}
          <JSXNode name="GridLineOverlay" /> will make the timeline more interactive.
        </p>

        <ExampleContainer>
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <GridLineOverlay showCursor allowZoom timeWindowConfig={timeWindowConfig} />
          <div ref={elementRef} style={{width: '100%', height: 40}}>
            <CheckInTimeline
              bucketedData={data}
              statusStyle={statusStyle}
              statusLabel={statusLabel}
              statusPrecedent={statusPrecedent}
              timeWindowConfig={timeWindowConfig}
            />
          </div>
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
