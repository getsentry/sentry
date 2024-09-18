import {Fragment} from 'react';

import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {BigNumberWidget} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidget';

export default storyBook(BigNumberWidget, story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidget" /> is a Dashboard Widget Component. It displays
          a single large value. Used in places like Dashboards Big Number widgets, Project
          Details pages, and Organization Stats pages.
        </p>

        <SizingWindow>
          <BigNumberWidget
            title="EPS"
            description="Number of events per second"
            data={[
              {
                'eps()': 0.01087819860850493,
              },
            ]}
            meta={{
              fields: {
                'eps()': 'rate',
              },
              units: {
                'eps()': '1/second',
              },
            }}
          />
        </SizingWindow>
      </Fragment>
    );
  });
});
