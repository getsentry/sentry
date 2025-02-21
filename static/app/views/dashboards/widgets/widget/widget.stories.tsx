import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

import {sampleDurationTimeSeries} from '../timeSeriesWidget/fixtures/sampleDurationTimeSeries';
import {TimeSeriesWidgetVisualization} from '../timeSeriesWidget/timeSeriesWidgetVisualization';

import {Widget} from './widget';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/views/dashboards/widgets/widget/widget';

export default storyBook('Widget', (story, APIReference) => {
  APIReference(types.exported);

  story('Getting Started', () => {
    const isLoading = false;
    const hasError = false;

    return (
      <Fragment>
        <p>
          A "Widget" is a common UI element in Sentry, used to show aggregate data. It
          consists of a frame, a title, an optional description, a visualization (e.g., a
          line chart), and an optional footer.
        </p>

        <SmallSizingWindow>
          <Widget
            Title={<Widget.WidgetTitle title="epm() : /insights/frontend/assets" />}
            Actions={
              <Widget.WidgetToolbar>
                <Button size="xs">Say More</Button>
                <Button size="xs">Say Less</Button>
                <Widget.WidgetDescription
                  title="epm() : /insights/frontend/assets"
                  description="Events received, tracked per minute"
                />
              </Widget.WidgetToolbar>
            }
            Visualization={
              isLoading ? (
                <TimeSeriesWidgetVisualization.LoadingPlaceholder />
              ) : hasError ? (
                <Widget.WidgetError error="Oh no!" />
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

  story('Widget', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="Widget" /> is a component as well as a component namespace. It's
          designed to make it easy to create widgets of your own.{' '}
        </p>
        <p>
          <JSXNode name="Widget" /> is a layout-only component. It contains no logic, all
          it does it place the passed sub-components in correct locations in a bordered
          widget frame. The contents of the <code>Title</code> prop are shown in the top
          left, and are always visible. The title is truncated to fit. The contents of the{' '}
          <code>Actions</code> prop are shown in the top right, and only shown on hover.
          You can set the <code>revealActions</code> prop to <code>"always"</code> to
          always show the actions. Actions are not truncated. The contents of{' '}
          <code>Visualization</code> are always visible, shown below the title and
          actions. The layout expands both horizontally and vertically to fit the parent.
        </p>

        <p>
          <JSXNode name="Widget" /> also provides a few sub-components:
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
            <li>
              <JSXNode name="Widget.Error" /> is an error panel that takes over the{' '}
              <code>Visualization</code> if needed
            </li>
          </ul>
        </p>

        <p>
          The best way to illustrate these concepts is a full example that uses all of the
          available components. The code below describes how to render the example widget
          shown above.
        </p>

        <CodeSnippet language="jsx">
          {`import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';
import {sampleDurationTimeSeries} from '../lineChartWidget/fixtures/sampleDurationTimeSeries';

import {Widget} from './widget';

<Widget
  Title={<Widget.TextTitle title="epm() : /insights/frontend/assets" />}
  Actions={
    <Widget.Toolbar>
      <Button size="xs">Say More</Button>
      <Button size="xs">Say Less</Button>
      <Widget.Description
        title="epm() : /insights/frontend/assets"
        description="Events received, tracked per minute"
      />
    </Widget.Toolbar>
  }
  Visualization={
    isLoading ? (
      <TimeSeriesWidgetVisualization.Placeholder />
    ) : hasError ? (
      <Widget.Error error="Oh no!" />
    ) : (
      <TimeSeriesWidgetVisualization
        visualizationType="line"
        timeSeries={[sampleDurationTimeSeries]}
      />
    )
  }
  Footer={<span>This data is incomplete!</span>}
/>

        `}
        </CodeSnippet>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: 400px;
  height: 300px;
`;
