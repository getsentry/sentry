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
              <TimeSeriesWidgetVisualization
                visualizationType="line"
                timeSeries={[sampleDurationTimeSeries]}
              />
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
              <JSXNode name="Widget.WidgetTitle" /> is a truncated title string
            </li>
            <li>
              <JSXNode name="Widget.WidgetDescription" /> is a description tooltip
            </li>
            <li>
              <JSXNode name="Widget.WidgetToolbar" /> is a wrapper for multiple buttons
            </li>
            <li>
              <JSXNode name="Widget.WidgetError" /> is an error panel that takes over the{' '}
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
    <TimeSeriesWidgetVisualization
      visualizationType="line"
      timeSeries={[sampleDurationTimeSeries]}
    />
  }
  Footer={<span>This data is incomplete!</span>}
/>

        `}
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Managing UI States', () => {
    return (
      <Fragment>
        <p>
          A common task for widget rendering is managing states. The example above omits
          this aspect of widget rendering. Here are some examples of common widget states:
        </p>

        <ul>
          <li>error (the data could not be loaded, or is invalid)</li>
          <li>loading (the data is being fetched)</li>
          <li>normal (data fetched successfully)</li>
          <li>no data (data loaded, but nothing came back)</li>
          <li>upsell (feature not configured, show instructions)</li>
        </ul>

        <p>
          <JSXNode name="Widget" /> does not handle this, it is up to you to implement
          those states. Below is an example of this kind of handling, with some guidance
          on how to do it well.
        </p>

        <CodeSnippet language="jsx">
          {`import {Widget} from './widget';

function InsightsLineChart() {
  // Fictional hooks, just for this example
  const {organization} = useOrganization();
  const {data, isLoading, error, retry} = useInsightsData();

  // Title should probably be the same in all states, but that's up to you
  const Title = <Widget.WidgetTitle title="eps()" />;

  if (!organization.features.includes('insights')) {
    // If there's a configuration or upsell state, handle this first.
    // Try to provide an action that a user can take to remedy the problem.
    return (
      <Widget
        Title={Title}
        Visualization={
          <div>
            <p>Sorry, this feature is not available!</p>
            <Button onClick={contactSupport}>Contact Support</Button>
          </div>
        }
      />
    );
  }

  if (isLoading) {
    // Loading states take precedence over error states!
    // Show a placeholder that makes it obvious that the data is still loading.
    // This state should be different from the "no data" state, described below.
    return (
      <Widget
        Title={Title}
        Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  if (error) {
    // Most importantly, an error state should clearly describe what went wrong.
    // Secondly, consider a "Retry" button in the toolbar for this case. If the
    // error is sporadic, a retry might get the data loaded. If the widget is
    // misconfigured, a retry won't help, so showing a "Retry" button is not a
    // good idea
    return (
      <Widget
        Title={Title}
        Actions={
          <Widget.WidgetToolbar>
            <Button size="xs" onClick={retry}>
              Retry
            </Button>
          </Widget.WidgetToolbar>
        }
        Visualization={<Widget.WidgetError error={error} />}
      />
    );
  }

  if (!data) {
    // Sometimes, the data loads but the response is empty. Consider why this
    // might happen in your use case, and provide some information to the user.
    // In most cases, "no data" is different from the loading state. It might be
    // closer to an error state!
    return (
      <Widget
        Title={Title}
        Visualization={
          <Widget.WidgetError
            error={'No data! This is unusual, consider contacting support'}
          />
        }
      />
    );
  }

  // If all is well, show all the relevant UI! Note that some actions (like "Add
  // to Dashboard") are probably fine to show in error states. Other actions,
  // like "Open in Full Screen" might need to be hidden if they cannot work
  // without data. Do what's right for the user!
  return (
    <Widget
      Title={Title}
      Actions={
        <Widget.WidgetToolbar>
          <Button size="xs" onClick={addToDashboard}>
            Add to Dashboard
          </Button>
          <Widget.WidgetDescription description="This shows how often the event is happening" />
        </Widget.WidgetToolbar>
      }
      Visualization={<TimeSeriesWidgetVisualization ...}
    />
  );
}

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
