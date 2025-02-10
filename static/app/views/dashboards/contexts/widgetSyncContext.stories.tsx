import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

import {sampleDurationTimeSeries} from '../widgets/lineChartWidget/fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from '../widgets/lineChartWidget/fixtures/sampleThroughputTimeSeries';
import {LineChartWidget} from '../widgets/lineChartWidget/lineChartWidget';

import {WidgetSyncContextProvider} from './widgetSyncContext';

export default storyBook('WidgetSyncContext', story => {
  story('Getting Started', () => {
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
          <SideBySide>
            <MediumWidget>
              <LineChartWidget
                title="span.duration"
                timeSeries={[sampleDurationTimeSeries]}
              />
            </MediumWidget>
            {visible && (
              <MediumWidget>
                <LineChartWidget
                  title="span.duration"
                  timeSeries={[sampleThroughputTimeSeries]}
                />
              </MediumWidget>
            )}
          </SideBySide>
        </WidgetSyncContextProvider>
      </Fragment>
    );
  });
});
const MediumWidget = styled('div')`
  width: 420px;
  height: 250px;
`;
