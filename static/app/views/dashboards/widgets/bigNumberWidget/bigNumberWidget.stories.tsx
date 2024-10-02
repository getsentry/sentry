import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
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
        <p>
          The <code>maximumValue</code> prop allows setting the maximum displayable value.
          e.g., imagine a widget that displays a count. A count of more than a million is
          too expensive for the API to compute, so the API returns a maximum of 1,000,000.
          If the API returns exactly 1,000,000, that means the actual number is unknown,
          something higher than the max. Setting{' '}
          <JSXProperty name="maximumValue" value={1000000} /> will show &gt;1m.
        </p>
        <SideBySide>
          <NormalWidget>
            <BigNumberWidget
              title="Count"
              data={[
                {
                  'count()': 1000000,
                },
              ]}
              maximumValue={1000000}
              meta={{
                fields: {
                  'count()': 'integer',
                },
              }}
            />
          </NormalWidget>
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
          <NormalWidget>
            <BigNumberWidget title="Loading Count" isLoading />
          </NormalWidget>
          <NormalWidget>
            <BigNumberWidget
              title="Text"
              data={[{'max(user.email)': 'bufo@example.com'}]}
            />
          </NormalWidget>
          <NormalWidget>
            <BigNumberWidget title="Missing Count" data={[{}]} />
          </NormalWidget>
          <NormalWidget>
            <BigNumberWidget
              title="Count Error"
              error={new Error('Something went wrong!')}
            />
          </NormalWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Previous Period Data', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidget" /> shows the difference of the current data and
          the previous period data as the difference between the two values, in small text
          next to the main value.
        </p>

        <p>
          The <code>preferredPolarity</code> prop controls the color of the comparison
          string. Setting <JSXProperty name="preferredPolarity" value={'+'} /> mean that a
          higher number is <i>better</i> and will paint increases in the value green. Vice
          versa with negative polarity. Omitting a preferred polarity will prevent
          colorization.
        </p>

        <SideBySide>
          <NormalWidget>
            <BigNumberWidget
              title="eps()"
              data={[
                {
                  'eps()': 17.1087819860850493,
                },
              ]}
              previousPeriodData={[
                {
                  'eps()': 15.0088607819850493,
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
          </NormalWidget>

          <NormalWidget>
            <BigNumberWidget
              title="http_rate(500)"
              data={[
                {
                  'http_rate(500)': 0.14227123,
                },
              ]}
              previousPeriodData={[
                {
                  'http_rate(500)': 0.1728139,
                },
              ]}
              preferredPolarity="-"
              meta={{
                fields: {
                  'http_rate(500)': 'percentage',
                },
              }}
            />
          </NormalWidget>
          <NormalWidget>
            <BigNumberWidget
              title="http_rate(200)"
              data={[
                {
                  'http_rate(200)': 0.14227123,
                },
              ]}
              previousPeriodData={[
                {
                  'http_rate(200)': 0.1728139,
                },
              ]}
              preferredPolarity="+"
              meta={{
                fields: {
                  'http_rate(200)': 'percentage',
                },
              }}
            />
          </NormalWidget>
        </SideBySide>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: auto;
  height: 200px;
`;

const NormalWidget = styled('div')`
  width: 250px;
`;
