import {Fragment} from 'react';
import documentation from '!!type-loader!sentry/views/dashboards/widgets/widget/widget';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
import * as Storybook from 'sentry/stories';
import {sampleDurationTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/fixtures/sampleDurationTimeSeries';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {Widget} from './widget';

export default Storybook.story('Widget', (story, APIReference) => {
  APIReference(documentation.props?.Widget);

  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          A "Widget" is a common UI element in Sentry, used to show aggregate data. It
          consists of a frame, a title, an optional description, a visualization (e.g., a
          line chart), and an optional footer.
        </p>

        <SmallStorybookSizingWindow>
          <Widget
            Title={<Widget.WidgetTitle title="epm() : /insights/frontend/assets" />}
            TitleBadges={[<Tag key="frontend">frontend</Tag>]}
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
                plottables={[new Line(sampleDurationTimeSeries)]}
              />
            }
            Footer={<span>This data is incomplete!</span>}
          />
        </SmallStorybookSizingWindow>
      </Fragment>
    );
  });

  story('Widget', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="Widget" /> is a component as well as a component
          namespace. It's designed to make it easy to create widgets of your own.{' '}
        </p>
        <p>
          <Storybook.JSXNode name="Widget" /> is a layout-only component. It contains no
          logic, all it does it place the passed sub-components in correct locations in a
          bordered widget frame. The contents of the <code>Title</code> prop are shown in
          the top left, and are always visible. The title is truncated to fit. The
          contents of the <code>Actions</code> prop are shown in the top right, and only
          shown on hover. You can set the <code>revealActions</code> prop to{' '}
          <code>"always"</code> to always show the actions. Actions are not truncated. The{' '}
          <code>TitleBadges</code> prop is shown to the immediate right of the title, and
          are always visible. The contents of <code>Visualization</code> are always
          visible, shown below the title and actions. The layout expands both horizontally
          and vertically to fit the parent.
        </p>

        <p>
          <Storybook.JSXNode name="Widget" /> also provides a few sub-components:
          <ul>
            <li>
              <Storybook.JSXNode name="Widget.WidgetTitle" /> is a truncated title string
            </li>
            <li>
              <Storybook.JSXNode name="Widget.WidgetDescription" /> is a description
              tooltip
            </li>
            <li>
              <Storybook.JSXNode name="Widget.WidgetToolbar" /> is a wrapper for multiple
              buttons
            </li>
            <li>
              <Storybook.JSXNode name="Widget.WidgetError" /> is an error panel that takes
              over the <code>Visualization</code> if needed
            </li>
          </ul>
        </p>

        <p>
          The best way to illustrate these concepts is a full example that uses all of the
          available components. The code below describes how to render the example widget
          shown above.
        </p>

        <CodeBlock language="jsx">
          {`import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';
import {sampleDurationTimeSeries} from '../lineChartWidget/fixtures/sampleDurationTimeSeries';

import {Widget} from './widget';

<Widget
  Title={<Widget.WidgetTitle title="epm() : /insights/frontend/assets" />}
  TitleBadges={[<Tag key="frontend">frontend</Tag>]}
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
        </CodeBlock>
      </Fragment>
    );
  });

  story('UI Behavior', () => {
    return (
      <Fragment>
        <p>There are a few UI behaviors you should be aware of:</p>
        <ul>
          <li>
            You can remove the padding within areas of the widget by passing the props{' '}
            <code>noFooterPadding</code>, <code>noHeaderPadding</code>, and{' '}
            <code>noVisualizationPadding</code>
          </li>
          <li>
            Avoid the <code>height</code> prop if you can. It's much easier and more
            robust to place <code>Widget</code> components within a CSS grid or another
            kind of layout, and size them that way
          </li>
        </ul>
      </Fragment>
    );
  });

  story('Connecting Widgets', () => {
    return (
      <Fragment>
        <p>
          Some widgets (e.g., <code>TimeSeriesWidgetVisualization</code> can be connected.
          Connecting widgets together synchronizes their axes, and axes pointers. To do
          this automatically, you can use <code>WidgetSyncContext</code>.
        </p>
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
          <Storybook.JSXNode name="Widget" /> does not handle this, it is up to you to
          implement those states. Below is an example of this kind of handling, with some
          guidance on how to do it well.
        </p>

        <CodeBlock language="jsx">
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
        </CodeBlock>
      </Fragment>
    );
  });
});

const SmallStorybookSizingWindow = styled(Storybook.SizingWindow)`
  width: 400px;
  height: 300px;
`;
