import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
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
      </Fragment>
    );
  });

  story('Visualization', () => {
    return (
      <Fragment>
        <p>
          The visualization of <JSXNode name="BigNumberWidget" /> a large number, just
          like it says on the tin. Depending on the data passed to it, it intelligently
          rounds and humanizes the results. If the number is humanized, hovering over the
          visualization shows a tooltip with the full value.
        </p>

        <SideBySide>
          <SmallSizingWindow>
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
          </SmallSizingWindow>
          <SmallSizingWindow>
            <BigNumberWidget
              title="Count"
              data={[
                {
                  'count()': 178451214,
                },
              ]}
              meta={{
                fields: {
                  'count()': 'integer',
                },
                units: {
                  'count()': null,
                },
              }}
            />
          </SmallSizingWindow>
          <SmallSizingWindow>
            <BigNumberWidget
              title="Query Duration"
              description="p95(span.duration)"
              data={[
                {
                  'p95(span.duration)': 17.28,
                },
              ]}
              meta={{
                fields: {
                  'p95(span.duration)': 'duration',
                },
                units: {
                  'p95(spa.duration)': 'milliseconds',
                },
              }}
            />
          </SmallSizingWindow>
        </SideBySide>
      </Fragment>
    );
  });

  story('State', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidget" /> supports the usual loading and error states.
          The loading state shows a simple placeholder.
        </p>

        <SideBySide>
          <SmallSizingWindow>
            <BigNumberWidget title="Count" isLoading />
          </SmallSizingWindow>
          <SmallSizingWindow>
            <BigNumberWidget
              title="Bad Count"
              error={new Error('Something went wrong!')}
            />
          </SmallSizingWindow>
        </SideBySide>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: auto;
  height: 200px;
`;
