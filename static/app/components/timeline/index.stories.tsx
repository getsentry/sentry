import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
import {DateTime} from 'sentry/components/dateTime';
import {StructuredData} from 'sentry/components/structuredEventData';
import {Timeline} from 'sentry/components/timeline';
import {
  IconClock,
  IconCursorArrow,
  IconDashboard,
  IconFire,
  IconSentry,
  IconSort,
} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Timeline', story => {
  story('Usage', () => (
    <CodeBlock language="js">
      import Timeline from 'sentry/components/timeline';
    </CodeBlock>
  ));

  story('<Timeline.Text />', () => {
    const theme = useTheme();
    return (
      <Fragment>
        <p>
          <code>{'<Timeline.Text />'}</code> can be used to easily format the children of
          <code>{'<Timeline.Item />'}</code>. It generally contains descriptive text.
        </p>
        <p>
          <CodeBlock language="jsx">
            {`<Timeline.Item ...>
  <Timeline.Text>{someText}</Timeline.Text>
</Timeline.Item>`}
          </CodeBlock>
        </p>
        <h6>Example</h6>
        <Timeline.Item
          title="SyntaxError"
          icon={<IconFire size="xs" />}
          timestamp={<DateTime date={now} />}
          colorConfig={{
            title: theme.tokens.content.danger,
            icon: theme.tokens.graphics.danger.vibrant,
            iconBorder: theme.tokens.border.danger.vibrant,
          }}
          isActive
        >
          <Timeline.Text>This is a description of the error</Timeline.Text>
        </Timeline.Item>
      </Fragment>
    );
  });

  story('<Timeline.Data />', () => {
    const theme = useTheme();
    return (
      <Fragment>
        <p>
          <code>{'<Timeline.Data />'}</code> is used to format the children of
          <code>{'<Timeline.Item />'}</code>. It generally contains code snippets or
          payloads.
        </p>
        <p>
          <CodeBlock language="jsx">
            {`<Timeline.Item ...>
  <Timeline.Data>
    <StructuredData value={someJson} ... />
  </Timeline.Data>
</Timeline.Item>`}
          </CodeBlock>
        </p>
        <h6>Example</h6>
        <Timeline.Item
          title="Navigation"
          icon={<IconSort rotated size="xs" />}
          timestamp={<DateTime date={now} />}
          colorConfig={{
            title: theme.tokens.content.success,
            icon: theme.tokens.graphics.success.vibrant,
            iconBorder: theme.tokens.border.success.vibrant,
          }}
        >
          <Timeline.Data>
            <StructuredData
              value={JSONPayload}
              maxDefaultDepth={1}
              withAnnotatedText
              withOnlyFormattedText
            />
          </Timeline.Data>
        </Timeline.Item>
      </Fragment>
    );
  });

  story('<Timeline.Item />', () => {
    const theme = useTheme();
    return (
      <Fragment>
        <p>
          <code>{'<Timeline.Item/>'}</code> contains each item to represent
        </p>
        <h6>Required Props</h6>
        <ul>
          <li>
            <code>icon</code> - Icon component to render alongside item. Size `xs`
            recommended.
          </li>
          <li>
            <code>title</code> - The header to appear on the item
          </li>
        </ul>
        <h6>Optional Props</h6>
        <ul>
          <li>
            <code>timestamp</code> - A component to render as the timestamp, if null, an
            empty div is used for spacing.
          </li>
          <li>
            <code>colorConfig</code> - A mapping of colors to use for emphasizing the item
          </li>
          <li>
            <code>isActive</code> - If set to true, will display a border under the item
          </li>
          <li>
            <code>onClick</code> - React event handler for the entire item
          </li>
          <li>
            <code>onMouseEnter</code> - React event handler for the entire item
          </li>
          <li>
            <code>onMouseLeave</code> - React event handler for the entire item
          </li>
        </ul>
        <h6>Example</h6>
        <Timeline.Item
          title="SyntaxError"
          icon={<IconFire size="xs" />}
          timestamp={<span style={{color: 'blue'}}>my cool timestamp</span>}
          colorConfig={{
            title: theme.tokens.content.danger,
            icon: theme.tokens.graphics.danger.vibrant,
            iconBorder: theme.tokens.border.danger.vibrant,
          }}
        />
        <Timeline.Item
          title="Active Item"
          icon={<IconCursorArrow size="xs" />}
          colorConfig={{
            title: theme.tokens.content.accent,
            icon: theme.tokens.graphics.accent.vibrant,
            iconBorder: theme.tokens.border.accent.vibrant,
          }}
          isActive
        >
          <Timeline.Text>
            This is a description of the error. I have no timestamp.
          </Timeline.Text>
        </Timeline.Item>
        <Timeline.Item
          title="Data"
          icon={<IconDashboard size="xs" />}
          timestamp={
            <Button size="xs" style={{marginBottom: 4}}>
              Button Timestamp!
            </Button>
          }
          colorConfig={{
            title: theme.tokens.content.promotion,
            icon: theme.tokens.graphics.promotion.vibrant,
            iconBorder: theme.tokens.border.promotion.vibrant,
          }}
        >
          <Timeline.Data>
            <StructuredData
              value={JSONPayload}
              maxDefaultDepth={1}
              withAnnotatedText
              withOnlyFormattedText
            />
          </Timeline.Data>
        </Timeline.Item>
        <Timeline.Item
          title="Another Event"
          icon={<IconClock size="xs" />}
          colorConfig={{
            title: theme.tokens.content.accent,
            icon: theme.tokens.graphics.accent.vibrant,
            iconBorder: theme.tokens.border.accent.vibrant,
          }}
        >
          <Timeline.Text>This is a description of the error</Timeline.Text>
        </Timeline.Item>
      </Fragment>
    );
  });

  story('<Timeline.Container />', () => {
    const theme = useTheme();
    return (
      <Fragment>
        <p>
          <code>{'<Timeline.Container />'}</code> expects to contain{' '}
          <code>{'<Timeline.Item />'}</code> components. Adds a vertical line behind the
          elements, even if the item is not marked 'isActive'.
        </p>
        <h6>Example</h6>
        <Timeline.Container>
          <Timeline.Item
            title="Error"
            icon={<IconFire size="xs" />}
            colorConfig={{
              title: theme.tokens.content.danger,
              icon: theme.tokens.graphics.danger.vibrant,
              iconBorder: theme.tokens.border.danger.vibrant,
            }}
          >
            <Timeline.Text>This is a description of the error</Timeline.Text>
          </Timeline.Item>

          <Timeline.Item
            title="HTTP"
            icon={<IconSort rotated size="xs" />}
            timestamp={<DateTime date={now} />}
            colorConfig={{
              title: theme.tokens.content.success,
              icon: theme.tokens.graphics.success.vibrant,
              iconBorder: theme.tokens.border.success.vibrant,
            }}
          >
            {' '}
            <Timeline.Data>
              <StructuredData
                value={JSONPayload}
                maxDefaultDepth={1}
                withAnnotatedText
                withOnlyFormattedText
              />
            </Timeline.Data>
          </Timeline.Item>

          <Timeline.Item
            title="UI Click"
            icon={<IconCursorArrow size="xs" />}
            timestamp={<DateTime date={now} />}
            colorConfig={{
              title: theme.tokens.content.accent,
              icon: theme.tokens.graphics.accent.vibrant,
              iconBorder: theme.tokens.border.primary,
            }}
          >
            <Timeline.Text>{'div.abc123 > xyz > somethingsomething'}</Timeline.Text>
          </Timeline.Item>

          <Timeline.Item
            title="Sentry Event"
            icon={<IconSentry size="xs" />}
            timestamp={<DateTime date={now} />}
            colorConfig={{
              title: theme.tokens.content.accent,
              icon: theme.tokens.graphics.accent.vibrant,
              iconBorder: theme.tokens.border.accent.vibrant,
            }}
          >
            <Timeline.Text>
              <a href="sentry.io">sentry.io</a>
            </Timeline.Text>
          </Timeline.Item>
        </Timeline.Container>
      </Fragment>
    );
  });
});

const JSONPayload: Record<string, any> = {
  logger: 'info',
  url: {
    addr: 'example.com/checkout',
    query: {isBetaUi: true},
  },
  user_id: 123,
  organizations: ['acme', 'xyz'],
};

const now = new Date();
