import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';
import sampleDurationTimeSeries from '../lineChartWidget/sampleDurationTimeSeries.json';

import {WidgetButton} from './widgetButton';
import {WidgetDescription} from './widgetDescription';
import {WidgetLayout} from './widgetLayout';
import {WidgetTitle} from './widgetTitle';

export default storyBook(WidgetLayout, story => {
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
          shown on hover. Actions are not truncated. The contents of{' '}
          <code>Visualization</code> are always visible, shown below the title and
          actions. The layout expands both horizontally and vertically to fit the parent.
        </p>

        <p>
          In order to make a nice-looking custom widget layout we recommend using the
          pre-built components that we provide alongside the layout.
        </p>

        <CodeSnippet language="jsx">
          {`import {LineChartWidgetVisualization} from '../lineChartWidget/lineChartWidgetVisualization';
import sampleDurationTimeSeries from '../lineChartWidget/sampleDurationTimeSeries.json';

import {WidgetButton} from './widgetButton';
import {WidgetDescription} from './widgetDescription';
import {WidgetLayout} from './widgetLayout';
import {WidgetTitle} from './widgetTitle';

<WidgetLayout
  Title={<WidgetTitle title="epm()" />}
  Actions={
    <Fragment>
      <WidgetButton>Say More</WidgetButton>
      <WidgetButton>Say Less</WidgetButton>
      <WidgetDescription
        title="epm()"
        description="Events received, tracked per minute"
      />
    </Fragment>
  }
  Visualization={
    <LineChartWidgetVisualization timeseries={[sampleDurationTimeSeries]} />
  }
  Caption={<p>This data is incomplete!</p>}
/>

        `}
        </CodeSnippet>

        <SmallSizingWindow>
          <WidgetLayout
            Title={<WidgetTitle title="epm()" />}
            Actions={
              <Fragment>
                <WidgetButton>Say More</WidgetButton>
                <WidgetButton>Say Less</WidgetButton>
                <WidgetDescription
                  title="epm()"
                  description="Events received, tracked per minute"
                />
              </Fragment>
            }
            Visualization={
              <LineChartWidgetVisualization timeseries={[sampleDurationTimeSeries]} />
            }
            Caption={<p>This data is incomplete!</p>}
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
