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
          like it says on the tin. Depending on the value passed to it, it intelligently
          rounds and humanizes the results. If the number is humanized, hovering over the
          visualization shows a tooltip with the full value.
        </p>

        <p>
          <JSXNode name="BigNumberWidget" /> also supports string values. This is not
          commonly used, but it's capable of rendering timestamps and in fact most fields
          defined in our field renderer pipeline
        </p>

        <SideBySide>
          <SmallSizingWindow>
            <BigNumberWidget
              title="EPS"
              description="Number of events per second"
              value={0.01087819860850493}
              field="eps()"
              meta={{
                fields: {
                  'eps()': 'rate',
                },
                units: {
                  'eps()': '1/second',
                },
              }}
              thresholds={{
                max_values: {
                  max1: 1,
                  max2: 2,
                },
                unit: '1/second',
              }}
            />
          </SmallSizingWindow>
          <SmallSizingWindow>
            <BigNumberWidget
              title="Count"
              value={178451214}
              field="count()"
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
              value={17.28}
              field="p95(span.duration)"
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
          <SmallSizingWindow>
            <BigNumberWidget
              title="Latest Timestamp"
              description=""
              value={'2024-10-17T16:08:07+00:00'}
              field="max(timestamp)"
              meta={{
                fields: {
                  'max(timestamp)': 'date',
                },
                units: {
                  'max(timestamp)': null,
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
          <SmallWidget>
            <BigNumberWidget
              title="Count"
              value={1000000}
              field="count()"
              maximumValue={1000000}
              meta={{
                fields: {
                  'count()': 'integer',
                },
              }}
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('State', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidget" /> supports the usual loading and error states.
          The loading state shows a simple placeholder. The error state also shows an
          optional "Retry" button.
        </p>

        <SideBySide>
          <SmallWidget>
            <BigNumberWidget title="Loading Count" isLoading />
          </SmallWidget>
          <SmallWidget>
            <BigNumberWidget title="Missing Count" />
          </SmallWidget>
          <SmallWidget>
            <BigNumberWidget
              title="Count Error"
              error={new Error('Something went wrong!')}
            />
          </SmallWidget>
          <SmallWidget>
            <BigNumberWidget
              title="Data Error"
              error={new Error('Something went wrong!')}
              onRetry={() => {}}
            />
          </SmallWidget>
        </SideBySide>

        <p>The contents of the error adjust slightly as the widget gets bigger.</p>

        <SideBySide>
          <MediumWidget>
            <BigNumberWidget
              title="Data Error"
              error={new Error('Something went wrong!')}
              onRetry={() => {}}
            />
          </MediumWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Previous Period Data', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidget" /> shows the difference of the current value and
          the previous period value as the difference between the two values, in small
          text next to the main value.
        </p>

        <p>
          The <code>preferredPolarity</code> prop controls the color of the comparison
          string. Setting <JSXProperty name="preferredPolarity" value={'+'} /> mean that a
          higher number is <i>better</i> and will paint increases in the value green. Vice
          versa with negative polarity. Omitting a preferred polarity will prevent
          colorization.
        </p>

        <SideBySide>
          <SmallWidget>
            <BigNumberWidget
              title="eps()"
              value={17.1087819860850493}
              field="eps()"
              previousPeriodValue={15.0088607819850493}
              meta={{
                fields: {
                  'eps()': 'rate',
                },
                units: {
                  'eps()': '1/second',
                },
              }}
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidget
              title="http_rate(500)"
              value={0.14227123}
              previousPeriodValue={0.1728139}
              field="http_rate(500)"
              preferredPolarity="-"
              meta={{
                fields: {
                  'http_rate(500)': 'percentage',
                },
              }}
            />
          </SmallWidget>
          <SmallWidget>
            <BigNumberWidget
              title="http_rate(200)"
              field="http_rate(200)"
              value={0.14227123}
              previousPeriodValue={0.1728139}
              preferredPolarity="+"
              meta={{
                fields: {
                  'http_rate(200)': 'percentage',
                },
              }}
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Thresholds', () => {
    const meta = {
      fields: {
        'eps()': 'rate',
      },
      units: {
        'eps()': '1/second',
      },
    };

    const thresholds = {
      max_values: {
        max1: 20,
        max2: 50,
      },
      unit: '1/second',
    };

    return (
      <Fragment>
        <p>
          <JSXNode name="BigNumberWidget" /> supports a <code>thresholds</code> prop. If
          specified, the value in the widget will be evaluated against these thresholds,
          and indicated using a colorful circle next to the value.
        </p>

        <SideBySide>
          <SmallWidget>
            <BigNumberWidget
              title="eps()"
              value={7.1}
              field="eps()"
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="+"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidget
              title="eps()"
              value={27.781}
              field="eps()"
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidget
              title="eps()"
              field="eps()"
              value={78.1}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="+"
            />
          </SmallWidget>
        </SideBySide>

        <p>
          The thresholds respect the preferred polarity. By default, the preferred
          polarity is positive (higher numbers are good).
        </p>

        <SideBySide>
          <SmallWidget>
            <BigNumberWidget
              title="eps()"
              field="eps()"
              value={7.1}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidget
              title="eps()"
              field="eps()"
              value={27.781}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>

          <SmallWidget>
            <BigNumberWidget
              title="eps()"
              field="eps()"
              value={78.1}
              meta={meta}
              thresholds={thresholds}
              preferredPolarity="-"
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: auto;
  height: 200px;
`;

const SmallWidget = styled('div')`
  width: 250px;
`;

const MediumWidget = styled('div')`
  width: 420px;
`;
