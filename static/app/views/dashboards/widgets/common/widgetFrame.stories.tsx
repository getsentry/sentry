import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import {t} from 'sentry/locale';
import storyBook from 'sentry/stories/storyBook';
import {WidgetFrame} from 'sentry/views/dashboards/widgets/common/widgetFrame';

export default storyBook(WidgetFrame, story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetFrame" /> is a container element used for all widgets in
          the Dashboards Widget Platform. It's mostly an under-the-hood component, but it
          can be useful to emulate widget-like states, like widget cards with actions.
        </p>
      </Fragment>
    );
  });

  story('Layout', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetFrame" /> supports a few basic props that control its
          content. This includes a title, a description, and the <code>children</code>.
          The title is automatically wrapped in a tooltip if it does not fit.
        </p>

        <SideBySide>
          <NormalWidget>
            <WidgetFrame
              title="Count"
              description="This counts up the amount of something that happens."
            />
          </NormalWidget>
          <NormalWidget>
            <WidgetFrame
              title="p95(measurements.lcp) / p95(measurements.inp)"
              description="This is a tough formula to reason about"
            />
          </NormalWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Warnings', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetFrame" /> supports a <code>warnings</code> prop. If
          supplied, it shows a small warning icon next to the title. Hovering over the
          icon shows the warnings.
        </p>

        <SideBySide>
          <NormalWidget>
            <WidgetFrame
              title="count()"
              warnings={[
                'We have automatically converted this widget to use sampled data.',
                'Data for this metrics has not been extracted yet',
              ]}
            />
          </NormalWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Action Menu', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetFrame" /> supports an action menu. If only one action is
          passed, the single action is rendered as a small button. If multiple actions are
          passed, they are grouped into a dropdown menu. Menu actions appear on hover or
          keyboard focus.
        </p>

        <SideBySide>
          <NormalWidget>
            <WidgetFrame
              title="Count"
              description="This counts up the amount of something that happens."
              actions={[
                {
                  key: 'see-more',
                  label: t('See More'),
                  onAction: () => {
                    // eslint-disable-next-line no-console
                    console.log('See more!');
                  },
                },
              ]}
            />
          </NormalWidget>

          <NormalWidget>
            <WidgetFrame
              title="Count"
              description="This is a tough formula to reason about"
              actions={[
                {
                  key: 'see-more',
                  label: t('See More'),
                  onAction: () => {
                    // eslint-disable-next-line no-console
                    console.log('See more!');
                  },
                },
                {
                  key: 'see-less',
                  label: t('See Less'),
                  onAction: () => {
                    // eslint-disable-next-line no-console
                    console.log('See less!');
                  },
                },
              ]}
            />
          </NormalWidget>
        </SideBySide>
      </Fragment>
    );
  });
});

const NormalWidget = styled('div')`
  width: 250px;
  height: 100px;
`;
