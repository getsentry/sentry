import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

import {sampleDurationTimeSeries} from '../lineChartWidget/fixtures/sampleDurationTimeSeries';
import {TimeSeriesWidgetVisualization} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

import {Widget} from './widget';

export default storyBook('Widget', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          A "Widget" is a common UI element in Sentry, used to show aggregate data. It
          consists of a frame, a title, an optional description, a visualization (e.g., a
          line chart) and other optional components. You can see an example below.{' '}
          <JSXNode name="Widget" />
          is a component as well as a component namespace designed to make it easy to
          create widgets of your own.
        </p>
        <p>
          <JSXNode name="Widget" /> itself is a layout component with minimal logic. It
          also provides several sub-components that can be combined to make a
          full-featured widget
        </p>
      </Fragment>
    );
  });

  story('Widget', () => {
    const isLoading: boolean = false;

    return (
      <Fragment>
        <p>
          <JSXNode name="Widget" /> is a layout-only component. It contains no logic, all
          it does it place the passed components in correct locations in a bordered widget
          frame. The contents of the <code>Title</code> prop are shown in the top left,
          and are always visible. The title is truncated to fit. The contents of the{' '}
          <code>Actions</code> prop are shown in the top right, and only shown on hover.
          You can set the <code>revealActions</code> prop to <code>"always"</code> to
          always show the actions. Actions are not truncated. The contents of{' '}
          <code>Visualization</code> are always visible, shown below the title and
          actions. The layout expands both horizontally and vertically to fit the parent.
        </p>

        <p>
          <JSXNode name="Widget" /> also provides a few sub-components!
          <ul>
            <li>
              <JSXNode name="Widget.TextTitle" /> is a truncated title string
            </li>
            <li>
              <JSXNode name="Widget.Description" /> is a description tooltip
            </li>
            <li>
              <JSXNode name="Widget.Toolbar" /> is a wrapper for multiple buttons
            </li>
          </ul>
        </p>

        <p>
          The best way to illustrate these concepts is a full example that uses all of the
          available components
        </p>

        <CodeSnippet language="jsx">
          {`import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';
import {sampleDurationTimeSeries} from '../lineChartWidget/fixtures/sampleDurationTimeSeries';

import {Widget} from './widget';

<Widget
  Title={<WidgetTitle title="epm() : /insights/frontend/assets" />}
  Actions={
    <Fragment>
      <Button size="xs">Say More</Button>
      <Button size="xs">Say Less</Button>
      <Widget.Description
        title="epm()"
        description="Events received, tracked per minute"
      />
    </Fragment>
  }
  Visualization={
    <LineChartWidgetVisualization timeseries={[sampleDurationTimeSeries]} />
  }
  Footer={<span>This data is incomplete!</span>}
/>

        `}
        </CodeSnippet>

        <SmallSizingWindow>
          <Widget
            Title={<Widget.TextTitle title="epm() : /insights/frontend/assets" />}
            Actions={
              isLoading ? null : (
                <Widget.Toolbar>
                  <Button size="xs">Say More</Button>
                  <Button size="xs">Say Less</Button>
                  <Widget.Description
                    title="epm() : /insights/frontend/assets"
                    description="Events received, tracked per minute"
                  />
                </Widget.Toolbar>
              )
            }
            Visualization={
              isLoading ? (
                <TimeSeriesWidgetVisualization.Placeholder />
              ) : (
                <TimeSeriesWidgetVisualization
                  visualizationType="line"
                  timeSeries={[sampleDurationTimeSeries]}
                />
              )
            }
            Footer={<span>This data is incomplete!</span>}
          />
        </SmallSizingWindow>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: 400px;
  height: 300px;
`;
