import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import * as Storybook from 'sentry/stories';
import {sampleDurationTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/fixtures/sampleThroughputTimeSeries';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {WidgetSyncContextProvider} from './widgetSyncContext';

const sampleDurationTimeSeries2 = {
  ...sampleDurationTimeSeries,
  field: 'p50(span.duration)',
  data: sampleDurationTimeSeries.values.map(datum => {
    return {
      ...datum,
      value: datum.value ? datum.value * 0.3 + 30 * Math.random() : null,
    };
  }),
};

export default Storybook.story('WidgetSyncContext', story => {
  story('Getting Started', () => {
    const [visible, setVisible] = useState<boolean>(false);

    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="WidgetSyncContext" /> is a Widget Context. All time
          series widget visualizations within this context will be synchronized via{' '}
          <code>echarts.connect</code>. This connects their axis pointers (horizontal and
          vertical) and their series. Turning off a series on one chart will turn off the
          matching series name on all visualizations within the context. If you wish to
          prevent this behavior, consider giving those series different names, and
          providing all of them with the same alias.
        </p>

        <p>
          <Button onClick={() => setVisible(true)}>Show Second Chart</Button>{' '}
          <Button onClick={() => setVisible(false)}>Hide Second Chart</Button>
        </p>

        <WidgetSyncContextProvider>
          <Storybook.SideBySide>
            <MediumWidget>
              <TimeSeriesWidgetVisualization
                plottables={[
                  new Line(sampleDurationTimeSeries),
                  new Line(sampleThroughputTimeSeries),
                ]}
              />
            </MediumWidget>
            {visible && (
              <MediumWidget>
                <TimeSeriesWidgetVisualization
                  plottables={[
                    new Line(sampleDurationTimeSeries2),
                    new Line(sampleThroughputTimeSeries),
                  ]}
                />
              </MediumWidget>
            )}
          </Storybook.SideBySide>
        </WidgetSyncContextProvider>
      </Fragment>
    );
  });
});
const MediumWidget = styled('div')`
  width: 420px;
  height: 250px;
`;
