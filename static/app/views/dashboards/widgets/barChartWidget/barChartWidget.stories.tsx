import {Fragment} from 'react';

import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('BarChartWidget', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          🚨 <JSXNode name="BarChartWidget" /> is deprecated! Instead, see the stories for{' '}
          <JSXNode name="Widget" />, which explain in detail how to compose your own
          widgets from standard components. If you want information on how to render a
          time series visualization, see the stories for
          <JSXNode name="TimeSeriesWidgetVisualization" />.
        </p>
      </Fragment>
    );
  });
});
