import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import * as KeyValueData from 'sentry/components/keyValueData/card';
import {IconCodecov, IconSentry, IconSettings} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import theme from 'sentry/utils/theme';

export default storyBook('KeyValueData', story => {
  story('Usage', () => (
    <Fragment>
      <CodeSnippet language="js">
        import * as KeyValueData from 'sentry/components/keyValueData/card';
      </CodeSnippet>
    </Fragment>
  ));
  story('<KeyValueData.Content />', () => (
    <Fragment>
      <p>
        <code>{'<KeyValueData.Content/>'}</code> will often be generated as a result of
        creating a <code>{'<KeyValueData.Card/>'}</code>
        component. These allow for customizing every item rendered in the card
        individually.
      </p>
      <h4>Props</h4>
      <ul>
        <li>
          <code>item</code> - A <code>KeyValueListDataItem</code> blob from the previous
          Key Value component. If a <code>subjectNode</code> is presented, we use that
          instead of the <code>subject</code>. If <code>subjectNode</code> is null, the
          value will span the full length. The only displayed action by default is{' '}
          <code>item.action.link</code>.
        </li>
        <li>
          <code>displayRichValue</code> - Disable automatic links from{' '}
          <code>item.action.link</code>
        </li>
        <li>
          <code>errors</code> - Errors to display at the end of the row
        </li>
        <li>
          <code>meta</code> - Metadata for adding annotations like redactions/filters
        </li>
      </ul>
      <KeyValueData.Card contentItems={contentItems} />
    </Fragment>
  ));

  story('<KeyValueData.Card />', () => (
    <Fragment>
      <p>
        Display a set of key-value data as a card. Creates structured data for lists/dicts
        and changes format based on value type. Any of the customization from{' '}
        <code>KeyValueData.Content</code> is available here, and display many of these
        cards using <code>KeyValueData.Group</code>.
      </p>
      <h4>Props</h4>
      <ul>
        <li>
          <code>contentItems</code> - A list of <code>KeyValueData.ContentProps</code>{' '}
          objects, which will be turned into the rows for the card.
        </li>
        <li>
          <code>title</code> - string or component to display above the data set
        </li>
        <li>
          <code>truncateLength</code> - length at which to display a show more toggle.
        </li>
        <li>
          <code>sortAlphabetically</code> - Enable to sort items based on{' '}
          <code>subject</code>
        </li>
      </ul>
      <KeyValueData.Group>
        <KeyValueData.Card
          title="Dataset Title"
          contentItems={contentItems.slice(0, 3)}
        />
        <KeyValueData.Card
          title="Alphabetical Sort"
          contentItems={contentItems}
          sortAlphabetically
        />
        <KeyValueData.Card
          title={
            <b style={{color: theme.green400}}>
              <IconSettings /> Custom Title Node
            </b>
          }
          contentItems={contentItems.slice(4, 9)}
        />
        <KeyValueData.Card
          title="Truncate at Length 4"
          contentItems={contentItems}
          truncateLength={4}
        />
      </KeyValueData.Group>
    </Fragment>
  ));

  story('<KeyValueData.Group />', () => (
    <Fragment>
      <p>
        <code>{'<KeyValueData.Group/>'}</code> can be used in combination with{' '}
        <code>{'<KeyValueData.Card/>'}</code> components to create a 'masonry' style
        layout for space efficiency. They leverage the{' '}
        <code>useIssueDetailsColumnCount</code> hook to distribute cards into the
        available space evenly. They don't accept any props, and just require{' '}
        <code>children</code>.
      </p>
      <CodeSnippet language="jsx">
        {`<KeyValueData.Group>
  <KeyValueData.Card ... />
  <KeyValueData.Card ... />
  <KeyValueData.Card ... />
</KeyValueData.Group>`}
      </CodeSnippet>
      <p>
        It should be noted that the number of items per card, or content size is not
        factored in, and can lead to some inconsistencies.
      </p>
      <KeyValueData.Group>
        <KeyValueData.Card contentItems={contentItems.slice(0, 2)} />
        <KeyValueData.Card contentItems={contentItems.slice(4, 6)} />
        <KeyValueData.Card contentItems={contentItems.slice(1, 6)} />
        <KeyValueData.Card contentItems={contentItems.slice(0, 8)} />
        <KeyValueData.Card contentItems={contentItems.slice(2, 5)} />
      </KeyValueData.Group>
    </Fragment>
  ));
});

const contentItems: KeyValueData.ContentProps[] = [
  {
    item: {
      key: 'string',
      subject: 'string',
      value: 'This is an example of a string.',
    },
  },
  {
    item: {
      key: 'number',
      subject: 'number',
      value: 20481027,
    },
  },

  {
    item: {
      key: 'array',
      subject: 'array',
      value: ['entry 0', 1, null, ['3'], {value: 4}] as any,
    },
  },
  {
    item: {
      key: 'null',
      subject: 'null',
      value: null,
    },
  },
  {
    item: {
      key: 'undefined',
      subject: 'undefined',
      value: undefined,
    },
  },
  {
    item: {
      key: 'external-url',
      subject: 'external url',
      value: 'https://sentry.io',
    },
  },
  {
    item: {
      key: 'action-link',
      subject: 'action link',
      value: 'Click to go to Sentry.io',
      action: {
        link: 'https://sentry.io',
      },
    },
  },
  {
    item: {
      key: 'disabled-action-link',
      subject: 'disabled action link',
      value: 'Click to go to Sentry.io',
      action: {
        link: 'https://sentry.io',
      },
    },
    disableRichValue: true,
  },
  {
    item: {
      key: 'subject-node',
      subject: 'custom subject node',
      subjectNode: (
        <span style={{color: theme.purple300}}>
          Custom Subject Node <IconSentry />
        </span>
      ),
      value: (
        <span style={{color: theme.pink300}}>
          Custom Value Node <IconCodecov />
        </span>
      ),
    },
  },
  {
    item: {
      key: 'null-subject-node',
      subject: 'null-subject-node',
      subjectNode: null,
      value: (
        <Alert type="warning" showIcon style={{margin: 0}}>
          Custom value can also span full length
        </Alert>
      ),
    },
  },
  {
    item: {
      key: 'redacted-value',
      subject: 'redacted value',
      value: '',
    },
    meta: {
      '': {
        chunks: [
          {
            remark: 'x',
            rule_id: 'project:0',
            text: '',
            type: 'redaction',
          },
        ],
        len: 1,
        rem: [['project:0', 'x', 0, 0]],
      },
    },
  },
  {
    item: {
      key: 'error-value',
      subject: 'error value',
      value: '',
    },
    meta: {
      '': {
        err: [
          [
            'invalid_data',
            {
              reason: 'This is a reason for the error',
            },
          ],
        ],
        val: 'error value',
      },
    },
    errors: [
      [
        'invalid_data',
        {
          reason: 'This is a reason for the error',
        },
      ],
    ],
  },
];
