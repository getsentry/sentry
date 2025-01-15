import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {DateTime} from 'sentry/components/dateTime';
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
      import Timeline from &apos;sentry/components/timeline&apos;;
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
        timestamp={<DateTime date={now} />}
        colorConfig={{
          title: 'red400',
          icon: 'red400',
          iconBorder: 'red200',
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
    <StructuredData value={someJson} ... />
  </Timeline.Data>
</Timeline.Item>`}
        </CodeSnippet>
      </p>
      <h6>Example</h6>
      <Timeline.Item
        title={'Navigation'}
        icon={<IconSort rotated size="xs" />}
        timestamp={<DateTime date={now} />}
        colorConfig={{
          title: 'green400',
          icon: 'green400',
          iconBorder: 'green200',
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
        title={'SyntaxError'}
        icon={<IconFire size="xs" />}
        timestamp={<span style={{color: 'blue'}}>my cool timestamp</span>}
        colorConfig={{
          title: 'red400',
          icon: 'red400',
          iconBorder: 'red200',
        }}
      />
      <Timeline.Item
        title={'Active Item'}
        icon={<IconCursorArrow size="xs" />}
        colorConfig={{
          title: 'blue400',
          icon: 'blue400',
          iconBorder: 'blue200',
        }}
        isActive
      >
        <Timeline.Text>
          This is a description of the error. I have no timestamp.
        </Timeline.Text>
      </Timeline.Item>
      <Timeline.Item
        title={'Data'}
        icon={<IconDashboard size="xs" />}
        timestamp={
          <Button size="xs" style={{marginBottom: 4}}>
            Button Timestamp!
          </Button>
        }
        colorConfig={{
          title: 'pink400',
          icon: 'pink400',
          iconBorder: 'pink200',
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
        title={'Another Event'}
        icon={<IconClock size="xs" />}
        colorConfig={{
          title: 'purple400',
          icon: 'purple400',
          iconBorder: 'purple200',
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
        elements, even if the item is not marked &apos;isActive&apos;.
      </p>
      <h6>Example</h6>
      <Timeline.Container>
        <Timeline.Item
          title={'Error'}
          icon={<IconFire size="xs" />}
          colorConfig={{
            title: 'red400',
            icon: 'red400',
            iconBorder: 'red200',
          }}
        >
          <Timeline.Text>This is a description of the error</Timeline.Text>
        </Timeline.Item>

        <Timeline.Item
          title={'HTTP'}
          icon={<IconSort rotated size="xs" />}
          timestamp={<DateTime date={now} />}
          colorConfig={{
            title: 'green400',
            icon: 'green400',
            iconBorder: 'green200',
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
          title={'UI Click'}
          icon={<IconCursorArrow size="xs" />}
          timestamp={<DateTime date={now} />}
          colorConfig={{
            title: 'blue400',
            icon: 'blue400',
            iconBorder: 'blue200',
          }}
        >
          <Timeline.Text>{'div.abc123 > xyz > somethingsomething'}</Timeline.Text>
        </Timeline.Item>

        <Timeline.Item
          title={'Sentry Event'}
          icon={<IconSentry size="xs" />}
          timestamp={<DateTime date={now} />}
          colorConfig={{
            title: 'purple400',
            icon: 'purple400',
            iconBorder: 'purple200',
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
