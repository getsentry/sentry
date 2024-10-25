import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';

import {LineChartWidget} from './lineChartWidget';

export default storyBook(LineChartWidget, story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="LineChartWidget" /> is a Dashboard Widget Component. It displays
          a timeseries chart with more than one timeseries. Used to visualize data that
          changes over time in Project Details, Dashboards, Performance, and other UIs
        </p>
      </Fragment>
    );
  });

  story('Visualization', () => {
    return (
      <Fragment>
        <p>
          The visualization of <JSXNode name="LineChartWidget" /> a line chart. It has
          some bells and whistles including automatic axes labels, and a hover tooltip.
        </p>

        <MediumWidget>
          <LineChartWidget
            title="EPS"
            description="Number of events per second"
            meta={{
              fields: {
                'eps()': 'rate',
              },
              units: {
                'eps()': '1/second',
              },
            }}
          />
        </MediumWidget>
      </Fragment>
    );
  });
});

const MediumWidget = styled('div')`
  width: 420px;
`;
