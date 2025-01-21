import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import {t, tct} from 'sentry/locale';
import storyBook from 'sentry/stories/storyBook';
import {WidgetFrame} from 'sentry/views/dashboards/widgets/widgetFrame/widgetFrame';

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

        <p>
          The description can be a React element, but don't go overboard. Stick to
          strings, or <code>tct</code> output consisting of text and links.
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
          <NormalWidget>
            <WidgetFrame
              title="p95(span.duration)"
              description={tct('Learn more about this on our [documentation] website.', {
                documentation: (
                  <ExternalLink href="https://docs.sentry.io">
                    {t('documentation')}
                  </ExternalLink>
                ),
              })}
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

  story('Badge', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetFrame" /> supports a <code>badgeProps</code> prop. If
          passed, a<code>Badge</code> component with the relevant props appears in the
          header. Note: Avoid using this! This is mostly used as an internal feature, for
          diagnosing widget state at a glance. We might remove this feature very soon.{' '}
          <i>Especially</i> avoid multiple badges.
        </p>

        <SideBySide>
          <NormalWidget>
            <WidgetFrame
              title="count()"
              badgeProps={[
                {
                  text: 'Alpha',
                  type: 'alpha',
                },
                {
                  text: 'Sampled',
                  type: 'default',
                },
              ]}
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
          keyboard focus. They can be disabled with the <code>actionsDisabled</code> prop,
          and supplemented with an optional <code>actionsMessage</code> prop that adds a
          tooltip.
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
              actionsDisabled
              actionsMessage="Not possible here"
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

          <NormalWidget>
            <WidgetFrame
              title="Count"
              actionsDisabled
              actionsMessage="Not available in this context"
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

  story('Full Screen View Button', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="WidgetFrame" /> supports a <code>onOpenFullScreenView</code>{' '}
          prop. This is a special action that always appears as an individual icon to the
          right of the normal actions.
        </p>

        <SideBySide>
          <NormalWidget>
            <WidgetFrame title="count()" onFullScreenViewClick={() => {}} />
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
