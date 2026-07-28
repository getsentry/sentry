import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Text} from '@sentry/scraps/text';

import {KeyValue, type KeyValueEntry} from 'sentry/components/keyValue';
import {IconEdit, IconSentry, IconSettings} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

export default Storybook.story('KeyValue', story => {
  story('Usage', () => (
    <Fragment>
      <Text as="p">
        <code>KeyValue</code> renders a list of key/value pairs in one of three layouts.
        Every layout accepts the same <code>items</code>, so switching presentation never
        means switching component.
      </Text>
      <CodeBlock language="jsx">
        {`import {KeyValue} from 'sentry/components/keyValue';

<KeyValue items={items} card layout="detail" sort="subject" />`}
      </CodeBlock>
    </Fragment>
  ));

  story('layout="list"', () => (
    <Fragment>
      <Text as="p">
        A compact two-column definition list. Values are right-aligned and truncated, so
        this layout suits short scalar values such as counts and identifiers. Values are
        rendered as-is by default.
      </Text>
      <KeyValue items={SIMPLE_ITEMS} layout="list" />
      <Text as="p">
        Pass <code>status</code> on an entry to tint the row.
      </Text>
      <KeyValue items={STATUS_ITEMS} layout="list" />
    </Fragment>
  ));

  story('layout="detail"', () => (
    <Fragment>
      <Text as="p">
        Monospace values that wrap across as many lines as they need, with the key column
        shrunk to its content. Use it for event interfaces and other long-form values.
      </Text>
      <KeyValue items={ITEMS} layout="detail" sort="key" valueDisplay="expandable" />
      <Text as="p">
        <code>keyColumn</code> controls how much width the key column takes:{' '}
        <code>equal</code> (the default), <code>wide</code>, or <code>fit</code>.
      </Text>
      <KeyValue items={SIMPLE_ITEMS} keyColumn="wide" layout="detail" />
      <KeyValue items={SIMPLE_ITEMS} keyColumn="fit" layout="detail" />
    </Fragment>
  ));

  story('<KeyValue.Row />', () => (
    <Fragment>
      <Text as="p">
        When rows come from separate components — each with its own data fetching or
        conditional rendering — compose them with <code>KeyValue.Row</code> instead of
        building an <code>items</code> array. Sorting and truncation do not apply to the
        compositional form.
      </Text>
      <KeyValue layout="list">
        <KeyValue.Row keyName="Monitor slug" value="my-cron-job" />
        <KeyValue.Row keyName="Failure tolerance" value="2 check-ins" />
        <KeyValue.Row keyName="Last run" status="error" value="Timed out" />
      </KeyValue>
    </Fragment>
  ));

  story('card layout="detail"', () => (
    <Fragment>
      <Text as="p">
        A panel with a title and monospaced, structured values. This is the layout used
        throughout issue details.
      </Text>
      <KeyValue items={ITEMS} card layout="detail" title="Card Title" />
      <Text as="p">
        <code>truncateLength</code> collapses long lists behind a toggle, and
        <code>sort</code> reorders entries.
      </Text>
      <KeyValue
        items={ITEMS}
        card
        layout="detail"
        sort="subject"
        title="Sorted and truncated"
        truncateLength={4}
      />
    </Fragment>
  ));

  story('<KeyValue.Container />', () => (
    <Fragment>
      <Text as="p">
        <code>KeyValue.Container</code> distributes cards into as many columns as the
        available width allows. It measures its own width, so the number of columns
        responds to the container rather than the viewport.
      </Text>
      <CodeBlock language="jsx">
        {`<KeyValue.Container>
  <KeyValue card layout="detail" ... />
  <KeyValue card layout="detail" ... />
</KeyValue.Container>`}
      </CodeBlock>
      <KeyValue.Container>
        <KeyValue items={ITEMS.slice(0, 2)} card layout="detail" title="First" />
        <KeyValue items={ITEMS.slice(2, 6)} card layout="detail" title="Second" />
        <KeyValue items={ITEMS.slice(0, 5)} card layout="detail" title="Third" />
        <KeyValue items={ITEMS} card layout="detail" title="Fourth" />
        <KeyValue items={ITEMS.slice(3, 6)} card layout="detail" title="Fifth" />
      </KeyValue.Container>
    </Fragment>
  ));

  story('Standalone <KeyValue.Row />', () => (
    <Fragment>
      <Text as="p">
        A single row from an <code>entry</code>, for callers composing rows into their own
        two-column grid. Rows inherit their columns via <code>subgrid</code>, so a grid
        parent is required.
      </Text>
      <KeyValue.Row entry={BROWSER} />
    </Fragment>
  ));

  story('valueDisplay', () => (
    <Fragment>
      <Text as="p">
        <code>valueDisplay</code> controls how a value is turned into a node. It defaults
        to <code>formatted</code> for the card layout and <code>raw</code> for the others,
        and each entry may override the list-wide choice.
      </Text>
      <Storybook.SideBySide>
        <KeyValue items={NESTED_ITEMS} card layout="detail" title="formatted" />
        <KeyValue
          items={NESTED_ITEMS}
          card
          layout="detail"
          title="expandable"
          valueDisplay="expandable"
        />
        <KeyValue
          items={NESTED_ITEMS}
          card
          layout="detail"
          title="raw"
          valueDisplay="raw"
        />
      </Storybook.SideBySide>
    </Fragment>
  ));
});

const BROWSER: KeyValueEntry = {
  key: 'browser',
  subject: 'Browser',
  value: 'Chrome 138.0.0',
};

const SIMPLE_ITEMS: KeyValueEntry[] = [
  BROWSER,
  {key: 'os', subject: 'OS', value: 'macOS 15.5'},
  {key: 'events', subject: 'Events', value: 20481027},
];

const STATUS_ITEMS: KeyValueEntry[] = [
  {key: 'ok', subject: 'Healthy', value: 'No problems found'},
  {
    key: 'suspect',
    status: 'warning',
    subject: 'Suspect flag',
    value: 'enable-new-checkout',
  },
  {key: 'failed', status: 'error', subject: 'Failed', value: 'Could not be parsed'},
];

const NESTED_ITEMS: KeyValueEntry[] = [
  {key: 'dict', subject: 'dict', value: {primary: 'alpha', secondary: 2}},
  {key: 'array', subject: 'array', value: ['entry 0', 1, null] as any},
];

const ITEMS: KeyValueEntry[] = [
  {key: 'string', subject: 'string', value: 'This is an example of a string.'},
  {key: 'number', subject: 'number', value: 20481027},
  {key: 'array', subject: 'array', value: ['entry 0', 1, null, ['3']] as any},
  {key: 'dict', subject: 'dict', value: {primary: 'alpha', secondary: 2}},
  {key: 'null', subject: 'null', value: null},
  {key: 'external-url', subject: 'external url', value: 'https://sentry.io'},
  {
    action: {link: 'https://sentry.io'},
    key: 'action-link',
    subject: 'action link',
    value: 'Click to go to Sentry.io',
  },
  {
    actionButton: (
      <Button
        aria-label="Edit"
        icon={<IconEdit size="xs" />}
        size="zero"
        variant="transparent"
      />
    ),
    key: 'action-button',
    subject: 'action button',
    value: 'I show a button on hover',
  },
  {
    key: 'subject-node',
    subject: 'custom subject node',
    subjectNode: (
      <Text variant="accent">
        Custom Subject Node <IconSentry />
      </Text>
    ),
    value: (
      <Text variant="promotion">
        Custom Value Node <IconSettings />
      </Text>
    ),
  },
  {
    key: 'null-subject-node',
    subjectNode: null,
    value: <Alert variant="warning">Custom value can also span full length</Alert>,
  },
  {
    key: 'redacted-value',
    meta: {
      '': {
        chunks: [{remark: 'x', rule_id: 'project:0', text: '', type: 'redaction'}],
        len: 1,
        rem: [['project:0', 'x', 0, 0]],
      },
    },
    subject: 'redacted value',
    value: '',
  },
  {
    errors: [['invalid_data', {reason: 'This is a reason for the error'}]],
    key: 'error-value',
    meta: {
      '': {
        err: [['invalid_data', {reason: 'This is a reason for the error'}]],
        val: 'error value',
      },
    },
    subject: 'error value',
    value: '',
  },
];
