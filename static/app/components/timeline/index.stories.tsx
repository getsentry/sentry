import {Fragment} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {StructuredData} from 'sentry/components/structuredEventData';
import Timeline from 'sentry/components/timeline';
import {
  IconClock,
  IconCursorArrow,
  IconDashboard,
  IconFire,
  IconSentry,
  IconSort,
} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Timeline (Updated 06/17/24)', story => {
  story('Usage', () => (
    <CodeSnippet language="js">
      import Timeline from 'sentry/components/timeline';
    </CodeSnippet>
  ));

  story('<Timeline.Text />', () => (
    <Fragment>
      <p>
        <code>{'<Timeline.Text />'}</code> can be used to easily format the children of
        <code>{'<Timeline.Item />'}</code>. It generally contains descriptive text.
      </p>
      <p>
        <CodeSnippet language="jsx">
          {`<Timeline.Item ...>
  <Timeline.Text>{someText}</Timeline.Text>
</Timeline.Item>`}
        </CodeSnippet>
      </p>
      <h6>Example</h6>
      <Timeline.Item
        title={'SyntaxError'}
        icon={<IconFire size="xs" />}
        timeString={now.toISOString()}
        colorConfig={{
          primary: 'red400',
          secondary: 'red200',
        }}
        isActive
      >
        <Timeline.Text>This is a description of the error</Timeline.Text>
      </Timeline.Item>
    </Fragment>
  ));

  story('<Timeline.Data />', () => (
    <Fragment>
      <p>
        <code>{'<Timeline.Data />'}</code> is used to format the children of
        <code>{'<Timeline.Item />'}</code>. It generally contains code snippets or
        payloads.
      </p>
      <p>
        <CodeSnippet language="jsx">
          {`<Timeline.Item ...>
  <Timeline.Data>
    <StructuredData value={someJson} />
  </Timeline.Data>
</Timeline.Item>`}
        </CodeSnippet>
      </p>
      <h6>Example</h6>
      <Timeline.Item
        title={'Navigation'}
        icon={<IconSort rotated size="xs" />}
        timeString={now.toISOString()}
        colorConfig={{
          primary: 'green400',
          secondary: 'green200',
        }}
      >
        <Timeline.Data>
          <StructuredData
            value={JSONPayload}
            depth={0}
            maxDefaultDepth={1}
            meta={undefined}
            withAnnotatedText
            withOnlyFormattedText
          />
        </Timeline.Data>
      </Timeline.Item>
    </Fragment>
  ));

  story('<Timeline.Item />', () => (
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
          <code>timeString</code> - ISO time string detailing the moment the item happened
        </li>
        <li>
          <code>title</code> - The header to appear on the item
        </li>
      </ul>
      <h6>Optional Props</h6>
      <ul>
        <li>
          <code>startTimeString</code> - If provided, time will be displayed relative to
          start time.
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
        title={'SyntaxError'}
        icon={<IconFire size="xs" />}
        timeString={now.toISOString()}
        colorConfig={{
          primary: 'red400',
          secondary: 'red200',
        }}
      />
      <Timeline.Item
        title={'Active Item'}
        icon={<IconCursorArrow size="xs" />}
        timeString={now.toISOString()}
        colorConfig={{
          primary: 'blue400',
          secondary: 'blue200',
        }}
        isActive
      >
        <Timeline.Text>This is a description of the error</Timeline.Text>
      </Timeline.Item>
      <Timeline.Item
        title={'Data'}
        icon={<IconDashboard size="xs" />}
        timeString={now.toISOString()}
        colorConfig={{
          primary: 'pink400',
          secondary: 'pink200',
        }}
      >
        <Timeline.Data>
          <StructuredData
            value={JSONPayload}
            depth={0}
            maxDefaultDepth={1}
            meta={undefined}
            withAnnotatedText
            withOnlyFormattedText
          />
        </Timeline.Data>
      </Timeline.Item>
      <Timeline.Item
        title={'Relative Event'}
        icon={<IconClock size="xs" />}
        timeString={now.toISOString()}
        startTimeString={before.toISOString()}
        colorConfig={{
          primary: 'purple400',
          secondary: 'purple200',
        }}
      >
        <Timeline.Text>This is a description of the error</Timeline.Text>
      </Timeline.Item>
    </Fragment>
  ));

  story('<Timeline.Container />', () => (
    <Fragment>
      <p>
        <code>{'<Timeline.Container />'}</code> expects to contain{' '}
        <code>{'<Timeline.Item />'}</code> components. Adds a vertical line behind the
        elements, even if the item is not marked 'isActive'.
      </p>
      <h6>Example</h6>
      <Timeline.Container>
        <Timeline.Item
          title={'Error'}
          icon={<IconFire size="xs" />}
          timeString={now.toISOString()}
          colorConfig={{
            primary: 'red400',
            secondary: 'red200',
          }}
        >
          <Timeline.Text>This is a description of the error</Timeline.Text>
        </Timeline.Item>

        <Timeline.Item
          title={'HTTP'}
          icon={<IconSort rotated size="xs" />}
          timeString={now.toISOString()}
          colorConfig={{
            primary: 'green400',
            secondary: 'green200',
          }}
        >
          {' '}
          <Timeline.Data>
            <StructuredData
              value={JSONPayload}
              depth={0}
              maxDefaultDepth={1}
              meta={undefined}
              withAnnotatedText
              withOnlyFormattedText
            />
          </Timeline.Data>
        </Timeline.Item>

        <Timeline.Item
          title={'UI Click'}
          icon={<IconCursorArrow size="xs" />}
          timeString={now.toISOString()}
          colorConfig={{
            primary: 'blue400',
            secondary: 'blue200',
          }}
        >
          <Timeline.Text>{'div.abc123 > xyz > somethingsomething'}</Timeline.Text>
        </Timeline.Item>

        <Timeline.Item
          title={'Sentry Event'}
          icon={<IconSentry size="xs" />}
          timeString={now.toISOString()}
          colorConfig={{
            primary: 'purple400',
            secondary: 'purple200',
          }}
        >
          <Timeline.Text>
            <a href="sentry.io">sentry.io</a>
          </Timeline.Text>
        </Timeline.Item>
      </Timeline.Container>
    </Fragment>
  ));
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
const before = new Date('2024-06-15');
