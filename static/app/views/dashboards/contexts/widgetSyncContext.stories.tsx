import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

import {LineChartWidget} from '../widgets/lineChartWidget/lineChartWidget';
import sampleDurationTimeSeries from '../widgets/lineChartWidget/sampleDurationTimeSeries.json';
import sampleThroughputTimeSeries from '../widgets/lineChartWidget/sampleThroughputTimeSeries.json';

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
                timeseries={[sampleDurationTimeSeries]}
                meta={{
                  fields: {
                    'span.duration': 'duration',
                  },
                  units: {
                    'span.duration': 'millisecond',
                  },
                }}
              />
            </MediumWidget>
            {visible && (
              <MediumWidget>
                <LineChartWidget
                  title="span.duration"
                  timeseries={[sampleThroughputTimeSeries]}
                  meta={{
                    fields: {
                      'spm()': 'rate',
                    },
                    units: {
                      'spm()': '1/minute',
                    },
                  }}
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
