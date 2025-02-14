import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

import {sampleDurationTimeSeries} from '../lineChartWidget/fixtures/sampleDurationTimeSeries';
import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';

import {WidgetLayout} from './widgetLayout';

export default storyBook('WidgetLayout', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          In most cases, we recommend using standard widgets like{' '}
          <JSXNode name="LineChartWidget" />. If this isn't possible (because of custom
          layout needs), we offer a set of helper components. Components like{' '}
          <JSXNode name="WidgetLayout" /> can be used to create a standard-looking widget
          from near-scratch.
        </p>
      </Fragment>
    );
  });

  story('WidgetLayout', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetLayout" /> is a layout-only component. It contains no
          logic, all it does it place the passed components in correct locations in a
          bordered widget frame. The contents of the <code>Title</code> prop are shown in
          the top left, and are always visible. The title is truncated to fit. The
          contents of the <code>Actions</code> prop are shown in the top right, and only
          shown on hover. You can set the <code>revealActions</code> prop to{' '}
          <code>"always"</code> to always show the actions. Actions are not truncated. The
          contents of <code>Visualization</code> are always visible, shown below the title
          and actions. The layout expands both horizontally and vertically to fit the
          parent.
        </p>

        <p>
          In order to make a nice-looking custom widget layout we recommend using the
          pre-built components that we provide alongside the layout.
        </p>

        <CodeSnippet language="jsx">
          {`import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';
import {sampleDurationTimeSeries} from '../lineChartWidget/fixtures/sampleDurationTimeSeries';

import {WidgetButton} from './widgetButton';
import {WidgetDescription} from './widgetDescription';
import {WidgetLayout} from './widgetLayout';
import {WidgetTitle} from './widgetTitle';

<WidgetLayout
  Title={<WidgetTitle title="epm() : /insights/frontend/assets" />}
  Actions={
    <Fragment>
      <WidgetButton>Say More</WidgetButton>
      <WidgetButton>Say Less</WidgetButton>
      <WidgetLayout.Description
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
          <WidgetLayout
            Title={<WidgetLayout.TextTitle title="epm() : /insights/frontend/assets" />}
            Actions={
              <Fragment>
                <Button size="xs">Say More</Button>
                <Button size="xs">Say Less</Button>
                <WidgetLayout.Description
                  title="epm() : /insights/frontend/assets"
                  description="Events received, tracked per minute"
                />
              </Fragment>
            }
            Visualization={
              <LineChartWidgetVisualization timeSeries={[sampleDurationTimeSeries]} />
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
