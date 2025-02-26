import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import JSXNode from 'sentry/components/stories/jsxNode';
import StoryBook from 'sentry/stories/storyBook';

import {sampleDurationTimeSeries} from '../widgets/timeSeriesWidget/fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from '../widgets/timeSeriesWidget/fixtures/sampleThroughputTimeSeries';
import {TimeSeriesWidgetVisualization} from '../widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {WidgetSyncContextProvider} from './widgetSyncContext';

export default StoryBook('WidgetSyncContext', Story => {
  Story('Getting Started', () => {
    const [visible, setVisible] = useState<boolean>(false);

    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetSyncContext" /> is a Dashboard Widget Context. All Line
          Chart widgets within this context will be synchronized via{' '}
          <code>echarts.connect</code>
        </p>

        <p>
          <Button onClick={() => setVisible(true)}>Show Second Chart</Button>{' '}
          <Button onClick={() => setVisible(false)}>Hide Second Chart</Button>
        </p>

        <WidgetSyncContextProvider>
          <Story.SideBySide>
            <MediumWidget>
              <TimeSeriesWidgetVisualization
                visualizationType="line"
                timeSeries={[sampleDurationTimeSeries]}
              />
            </MediumWidget>
            {visible && (
              <MediumWidget>
                <TimeSeriesWidgetVisualization
                  visualizationType="area"
                  timeSeries={[sampleThroughputTimeSeries]}
                />
              </MediumWidget>
            )}
          </Story.SideBySide>
        </WidgetSyncContextProvider>
      </Fragment>
    );
  });
});
const MediumWidget = styled('div')`
  width: 420px;
  height: 250px;
`;
