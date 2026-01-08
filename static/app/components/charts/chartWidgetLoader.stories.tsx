import {Fragment} from 'react';
import documentation from '!!type-loader!sentry/components/charts/chartWidgetLoader';

import {CodeBlock} from 'sentry/components/core/code';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ChartWidgetLoader', (story, APIReference) => {
  APIReference(documentation.props?.ChartWidgetLoader);

  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="ChartWidgetLoader" /> is a helper component that
          dynamically imports and renders a chart. It currently only supports charts used
          in Insights, specifically all chart widgets that are defined in
          <code>sentry/views/insights/common/components/widgets</code>. However, it will
          be expanded to support at least one other chart type (
          <Storybook.JSXNode name="EventGraph" />) in the future.
        </p>

        <p>
          The intention will be to support all chart types used in Insights and all usages
          of these charts must be through this component. The motivation for this is the
          Releases Drawer, which needs to be able to render a chart from a URL. In order
          to do so, we need a component that handles its own data fetching and rendering,
          and be able to map a chart id to a component. Additionally, we need a single
          interface to render the chart widgets so that they do not get out of sync
          between Insights and the Releases Drawer (or other components that need to
          render these chart widgets).
        </p>

        <CodeBlock language="tsx">{`<ChartWidgetLoader id="chart-id" />`}</CodeBlock>
      </Fragment>
    );
  });
});
